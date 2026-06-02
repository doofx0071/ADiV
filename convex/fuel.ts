import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    const logs = await ctx.db.query("fuelLogs").order("asc").collect();
    if (logs.length === 0) {
      return {
        totalLiters: 0,
        totalCost: 0,
        avgPricePerLiter: 0,
        avgKmPerLiter: 0,
        logCount: 0,
      };
    }

    const totalLiters = logs.reduce((sum, l) => sum + l.liters, 0);
    const totalCost = logs.reduce((sum, l) => sum + l.totalPrice, 0);
    const avgPricePerLiter = totalCost / totalLiters;

    // Calculate km/L from consecutive logs
    let totalKm = 0;
    let totalLitersForEfficiency = 0;
    for (let i = 1; i < logs.length; i++) {
      const distance = logs[i].odometer - logs[i - 1].odometer;
      if (distance > 0) {
        totalKm += distance;
        totalLitersForEfficiency += logs[i].liters;
      }
    }

    const avgKmPerLiter = totalLitersForEfficiency > 0 ? totalKm / totalLitersForEfficiency : 0;

    return {
      totalLiters,
      totalCost,
      avgPricePerLiter,
      avgKmPerLiter,
      logCount: logs.length,
    };
  },
});

/**
 * Log a fuel-up.
 * Validates odometer is increasing and date is not in the future.
 */
export const logFuel = mutation({
  args: {
    odometer: v.number(),
    liters: v.number(),
    pricePerLiter: v.number(),
    date: v.number(),
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
    return await ctx.db.insert("fuelLogs", {
      odometer: args.odometer,
      liters: args.liters,
      pricePerLiter: args.pricePerLiter,
      totalPrice,
      date: args.date,
      stationName: args.stationName,
      notes: args.notes,
    });
  },
});

/**
 * Update a fuel log.
 */
export const updateFuelLog = mutation({
  args: {
    fuelLogId: v.id("fuelLogs"),
    stationName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.fuelLogId);
    if (!log) throw new Error(`Fuel log not found: ${args.fuelLogId}`);
    await ctx.db.patch(args.fuelLogId, {
      stationName: args.stationName,
      notes: args.notes,
    });
    return true;
  },
});

/**
 * Delete a fuel log.
 */
export const deleteFuelLog = mutation({
  args: {
    fuelLogId: v.id("fuelLogs"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.fuelLogId);
    if (!log) throw new Error(`Fuel log not found: ${args.fuelLogId}`);
    await ctx.db.delete(args.fuelLogId);
    return true;
  },
});
