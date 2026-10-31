import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Query all ride logs ordered by date desc.
 */
export const getRides = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("rides"),
      _creationTime: v.number(),
      startOdometer: v.number(),
      endOdometer: v.number(),
      distance: v.number(),
      date: v.number(),
      startAt: v.optional(v.number()),
      endAt: v.optional(v.number()),
      durationMinutes: v.number(),
      notes: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("rides")
      .withIndex("by_date", (q) => q)
      .order("desc")
      .take(limit);
  },
});

/**
 * Get total distance and ride count.
 */
export const getRideStats = query({
  args: {},
  returns: v.object({
    totalDistance: v.number(),
    totalRides: v.number(),
    totalDurationMinutes: v.number(),
  }),
  handler: async (ctx) => {
    const rides = await ctx.db.query("rides").collect();
    return {
      totalDistance: rides.reduce((sum, r) => sum + r.distance, 0),
      totalRides: rides.length,
      totalDurationMinutes: rides.reduce((sum, r) => sum + r.durationMinutes, 0),
    };
  },
});

/**
 * Log a ride.
 * Calculates distance from odometer readings and keeps the bike odometer
 * in sync so the reminder engine never sees stale readings.
 */
export const logRide = mutation({
  args: {
    startOdometer: v.number(),
    endOdometer: v.number(),
    date: v.number(),
    durationMinutes: v.optional(v.number()),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("rides"),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.startOdometer) || !Number.isFinite(args.endOdometer) || args.startOdometer < 0 || args.endOdometer < 0) {
      throw new Error("Odometer readings must be valid non-negative numbers.");
    }
    if (args.endOdometer < args.startOdometer) {
      throw new Error("End odometer cannot be less than start odometer");
    }
    if (args.date > Date.now()) {
      throw new Error("Ride date cannot be in the future");
    }

    const hasStartAt = args.startAt !== undefined;
    const hasEndAt = args.endAt !== undefined;
    if (hasStartAt !== hasEndAt) throw new Error("Provide both ride start and end times.");

    let durationMinutes = args.durationMinutes;
    if (hasStartAt && hasEndAt) {
      if (!Number.isFinite(args.startAt) || !Number.isFinite(args.endAt) || args.endAt! <= args.startAt!) {
        throw new Error("Ride end time must be later than its start time.");
      }
      if (args.startAt! > Date.now() || args.endAt! > Date.now()) {
        throw new Error("Ride times cannot be in the future.");
      }
      durationMinutes = Math.round((args.endAt! - args.startAt!) / 60_000);
    }
    if (durationMinutes === undefined || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 24 * 60) {
      throw new Error("Ride duration must be between 1 minute and 24 hours.");
    }

    const distance = args.endOdometer - args.startOdometer;
    const ride = {
      startOdometer: args.startOdometer,
      endOdometer: args.endOdometer,
      distance,
      date: args.date,
      durationMinutes,
      notes: args.notes,
      ...(args.startAt !== undefined ? { startAt: args.startAt } : {}),
      ...(args.endAt !== undefined ? { endAt: args.endAt } : {}),
    };
    const rideId = await ctx.db.insert("rides", ride);

    const bike = (await ctx.db.query("bike").take(1))[0];
    if (bike && args.endOdometer > bike.currentOdometer) {
      await ctx.db.patch(bike._id, { currentOdometer: args.endOdometer });
    }

    return rideId;
  },
});

/**
 * Update ride details while keeping the bike odometer at its highest confirmed reading.
 */
export const updateRide = mutation({
  args: {
    rideId: v.id("rides"),
    startOdometer: v.optional(v.number()),
    endOdometer: v.optional(v.number()),
    date: v.optional(v.number()),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.rideId);
    if (!ride) throw new Error(`Ride not found: ${args.rideId}`);

    if ((args.startAt === undefined) !== (args.endAt === undefined)) throw new Error("Provide both ride start and end times.");

    const startOdometer = args.startOdometer ?? ride.startOdometer;
    const endOdometer = args.endOdometer ?? ride.endOdometer;
    if (!Number.isFinite(startOdometer) || !Number.isFinite(endOdometer) || startOdometer < 0 || endOdometer < 0) {
      throw new Error("Odometer readings must be valid non-negative numbers.");
    }
    if (endOdometer < startOdometer) throw new Error("End odometer cannot be less than start odometer.");
    if (args.date !== undefined && args.date > Date.now()) throw new Error("Ride date cannot be in the future.");

    if (args.date !== undefined && (ride.startAt !== undefined || ride.endAt !== undefined) && (args.startAt === undefined || args.endAt === undefined)) {
      throw new Error("Update both ride times when changing the date of a timed ride.");
    }

    const startAt = args.startAt ?? ride.startAt;
    const endAt = args.endAt ?? ride.endAt;
    if ((startAt === undefined) !== (endAt === undefined)) throw new Error("Provide both ride start and end times.");

    const updates: Partial<typeof ride> = {};
    if (args.startOdometer !== undefined) updates.startOdometer = startOdometer;
    if (args.endOdometer !== undefined) updates.endOdometer = endOdometer;
    if (args.startOdometer !== undefined || args.endOdometer !== undefined) updates.distance = endOdometer - startOdometer;
    if (args.date !== undefined) updates.date = args.date;
    if (args.startAt !== undefined && args.endAt !== undefined) {
      if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt! <= startAt!) {
        throw new Error("Ride end time must be later than its start time.");
      }
      if (endAt! > Date.now()) throw new Error("Ride end time cannot be in the future.");
      const durationMinutes = Math.round((endAt! - startAt!) / 60_000);
      if (durationMinutes <= 0 || durationMinutes > 24 * 60) throw new Error("Ride duration must be between 1 minute and 24 hours.");
      updates.startAt = startAt;
      updates.endAt = endAt;
      updates.durationMinutes = durationMinutes;
    }
    if (args.notes !== undefined) {
      updates.notes = args.notes ?? undefined;
    }
    if (args.date !== undefined || args.startOdometer !== undefined || args.endOdometer !== undefined || args.startAt !== undefined || args.endAt !== undefined || args.notes !== undefined) {
      await ctx.db.patch(args.rideId, updates);
    }

    if (endOdometer > ride.endOdometer) {
      const bike = (await ctx.db.query("bike").take(1))[0];
      if (bike && endOdometer > bike.currentOdometer) await ctx.db.patch(bike._id, { currentOdometer: endOdometer });
    }
  },
});

/**
 * Delete a ride log.
 */
export const deleteRide = mutation({
  args: {
    rideId: v.id("rides"),
  },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.rideId);
    if (!ride) throw new Error(`Ride not found: ${args.rideId}`);
    await ctx.db.delete(args.rideId);
  },
});
