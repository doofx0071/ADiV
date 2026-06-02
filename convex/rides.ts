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
 * Calculates distance from odometer readings.
 */
export const logRide = mutation({
  args: {
    startOdometer: v.number(),
    endOdometer: v.number(),
    date: v.number(),
    durationMinutes: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("rides"),
  handler: async (ctx, args) => {
    if (args.endOdometer < args.startOdometer) {
      throw new Error("End odometer cannot be less than start odometer");
    }
    if (args.date > Date.now()) {
      throw new Error("Ride date cannot be in the future");
    }

    const distance = args.endOdometer - args.startOdometer;
    return await ctx.db.insert("rides", {
      startOdometer: args.startOdometer,
      endOdometer: args.endOdometer,
      distance,
      date: args.date,
      durationMinutes: args.durationMinutes,
      notes: args.notes,
    });
  },
});

/**
 * Update a ride log.
 */
export const updateRide = mutation({
  args: {
    rideId: v.id("rides"),
    notes: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.rideId);
    if (!ride) throw new Error(`Ride not found: ${args.rideId}`);
    await ctx.db.patch(args.rideId, { notes: args.notes });
    return true;
  },
});

/**
 * Delete a ride log.
 */
export const deleteRide = mutation({
  args: {
    rideId: v.id("rides"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.rideId);
    if (!ride) throw new Error(`Ride not found: ${args.rideId}`);
    await ctx.db.delete(args.rideId);
    return true;
  },
});
