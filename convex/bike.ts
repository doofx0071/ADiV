import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the user's bike profile.
 * Returns null if no bike has been set up yet.
 */
export const getBike = query({
  args: {},
  handler: async (ctx) => {
    const bike = await ctx.db.query("bike").take(1);
    return bike[0] ?? null;
  },
});

/**
 * Create the bike profile.
 * Singleton pattern: only one bike profile allowed.
 * Throws if a bike already exists.
 */
export const createBike = mutation({
  args: {
    name: v.string(),
    model: v.string(),
    year: v.number(),
    color: v.optional(v.string()),
    vin: v.optional(v.string()),
    purchaseDate: v.optional(v.number()),
    lastServiceDate: v.optional(v.number()),
    currentOdometer: v.number(),
    engineCc: v.number(),
    tireFront: v.string(),
    tireRear: v.string(),
    tirePressureFront: v.number(),
    tirePressureRear: v.number(),
    oilType: v.string(),
    oilCapacity: v.number(),
    coolantCapacity: v.number(),
    batteryType: v.string(),
    sparkPlugType: v.string(),
    fuelTankCapacity: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("bike").take(1);
    if (existing.length > 0) {
      throw new Error("Bike profile already exists");
    }

    return await ctx.db.insert("bike", {
      name: args.name,
      model: args.model,
      year: args.year,
      color: args.color,
      vin: args.vin,
      purchaseDate: args.purchaseDate,
      lastServiceDate: args.lastServiceDate,
      currentOdometer: args.currentOdometer,
      engineCc: args.engineCc,
      tireFront: args.tireFront,
      tireRear: args.tireRear,
      tirePressureFront: args.tirePressureFront,
      tirePressureRear: args.tirePressureRear,
      oilType: args.oilType,
      oilCapacity: args.oilCapacity,
      coolantCapacity: args.coolantCapacity,
      batteryType: args.batteryType,
      sparkPlugType: args.sparkPlugType,
      fuelTankCapacity: args.fuelTankCapacity,
      notes: args.notes,
    });
  },
});
