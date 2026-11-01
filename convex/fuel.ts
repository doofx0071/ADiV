import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { computeFuelInsights, type FuelLogInput } from "../lib/fuel-insights";

/**
 * Query all fuel logs ordered by date desc.
 */
export const getFuelLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("fuelLogs"),
      _creationTime: v.number(),
      odometer: v.number(),
      liters: v.number(),
      pricePerLiter: v.number(),
      totalPrice: v.number(),
      date: v.number(),
      fullTank: v.optional(v.boolean()),
      stationName: v.optional(v.string()),
      notes: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("fuelLogs")
      .withIndex("by_date", (q) => q)
      .order("desc")
      .take(limit);
  },
});

/**
 * Get fuel efficiency stats.
 *
 * avgKmPerLiter uses the filled-to-full method (lib/fuel-insights.ts): only
 * full→full windows count, partial fills merge into the closing segment, and
 * logs are paired in date order.
 */
export const getFuelStats = query({
  args: {},
  returns: v.object({
    totalLiters: v.number(),
    totalCost: v.number(),
    avgPricePerLiter: v.number(),
    avgKmPerLiter: v.number(),
    logCount: v.number(),
  }),
  handler: async (ctx) => {
    const logs = await ctx.db.query("fuelLogs").collect();
    const insights = computeFuelInsights(logs, null);
    return {
      totalLiters: insights.totalLiters,
      totalCost: insights.totalCost,
      avgPricePerLiter: insights.avgPricePerLiter,
      avgKmPerLiter: insights.avgKmPerLiter,
      logCount: insights.refuelCount,
    };
  },
});

/**
 * Full fuel analytics: accurate efficiency segments, price trends, refuel
 * patterns, per-station aggregates, and the tank range estimate.
 */
export const getFuelInsights = query({
  args: {},
  returns: v.object({
    refuelCount: v.number(),
    totalLiters: v.number(),
    totalCost: v.number(),
    avgPricePerLiter: v.number(),
    validSegments: v.array(
      v.object({
        kmL: v.number(),
        distanceKm: v.number(),
        liters: v.number(),
        cost: v.number(),
        date: v.number(),
      })
    ),
    avgKmPerLiter: v.number(),
    bestSegment: v.union(
      v.object({
        kmL: v.number(),
        distanceKm: v.number(),
        liters: v.number(),
        cost: v.number(),
        date: v.number(),
      }),
      v.null()
    ),
    worstSegment: v.union(
      v.object({
        kmL: v.number(),
        distanceKm: v.number(),
        liters: v.number(),
        cost: v.number(),
        date: v.number(),
      }),
      v.null()
    ),
    avgLitersPerRefuel: v.number(),
    avgDaysBetweenRefuels: v.number(),
    daysSinceLastRefuel: v.number(),
    priceSeries: v.array(
      v.object({ date: v.number(), pricePerLiter: v.number() })
    ),
    latestPricePerLiter: v.number(),
    monthlySpend: v.array(v.object({ key: v.string(), spend: v.number() })),
    costPerKm: v.number(),
    tankRangeKm: v.number(),
    stationStats: v.array(
      v.object({
        station: v.string(),
        visits: v.number(),
        liters: v.number(),
        totalCost: v.number(),
        avgPricePerLiter: v.number(),
      })
    ),
  }),
  handler: async (ctx) => {
    const logs = await ctx.db.query("fuelLogs").collect();
    const bike = (await ctx.db.query("bike").take(1))[0];
    const fuelLogs: FuelLogInput[] = logs.map((log) => ({
      odometer: log.odometer,
      liters: log.liters,
      date: log.date,
      pricePerLiter: log.pricePerLiter,
      totalPrice: log.totalPrice,
      fullTank: log.fullTank,
      stationName: log.stationName,
    }));
    return computeFuelInsights(fuelLogs, bike?.fuelTankCapacity ?? null);
  },
});

/**
 * Log a fuel-up.
 * Validates odometer is increasing and date is not in the future.
 * Keeps the bike odometer in sync so the reminder engine never sees
 * stale readings.
 */
export const logFuel = mutation({
  args: {
    odometer: v.number(),
    liters: v.number(),
    pricePerLiter: v.number(),
    date: v.number(),
    fullTank: v.optional(v.boolean()),
    stationName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("fuelLogs"),
  handler: async (ctx, args) => {
    if (args.liters <= 0) throw new Error("Liters must be positive");
    if (args.pricePerLiter <= 0) throw new Error("Price per liter must be positive");
    if (args.date > Date.now()) throw new Error("Fuel date cannot be in the future");

    // Check odometer is not decreasing
    const lastLog = await ctx.db
      .query("fuelLogs")
      .withIndex("by_date", (q) => q)
      .order("desc")
      .first();
    if (lastLog && args.odometer < lastLog.odometer) {
      throw new Error("Odometer cannot be less than last fuel log");
    }

    const totalPrice = args.liters * args.pricePerLiter;
    const logId = await ctx.db.insert("fuelLogs", {
      odometer: args.odometer,
      liters: args.liters,
      pricePerLiter: args.pricePerLiter,
      totalPrice,
      date: args.date,
      fullTank: args.fullTank,
      stationName: args.stationName,
      notes: args.notes,
    });

    const bike = (await ctx.db.query("bike").take(1))[0];
    if (bike && args.odometer > bike.currentOdometer) {
      await ctx.db.patch(bike._id, { currentOdometer: args.odometer });
    }

    return logId;
  },
});

/**
 * Update a fuel log (station name, notes, and the full-tank flag only).
 */
export const updateFuelLog = mutation({
  args: {
    fuelLogId: v.id("fuelLogs"),
    stationName: v.optional(v.string()),
    notes: v.optional(v.string()),
    fullTank: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.fuelLogId);
    if (!log) throw new Error(`Fuel log not found: ${args.fuelLogId}`);
    // Guard the patch: passing undefined to patch would delete the field.
    const updates: Partial<typeof log> = {};
    if (args.stationName !== undefined) updates.stationName = args.stationName;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.fullTank !== undefined) updates.fullTank = args.fullTank;
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.fuelLogId, updates);
    }
  },
});

/**
 * Delete a fuel log.
 */
export const deleteFuelLog = mutation({
  args: {
    fuelLogId: v.id("fuelLogs"),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.fuelLogId);
    if (!log) throw new Error(`Fuel log not found: ${args.fuelLogId}`);
    await ctx.db.delete(args.fuelLogId);
  },
});
