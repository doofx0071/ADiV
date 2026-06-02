/**
 * Seed mutation — populates the maintenanceItems table with the official
 * Honda ADV160 maintenance schedule.
 *
 * IDEMPOTENT: If any maintenance items already exist, the mutation skips
 * seeding. Running it multiple times will not duplicate data.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { SEED_MAINTENANCE_ITEMS } from "./seedData";

export const seed = mutation({
  args: {
    force: v.optional(v.boolean()),
  },
  returns: v.object({
    seeded: v.boolean(),
    count: v.number(),
  }),
  handler: async (ctx, args) => {
    // Check if maintenance items already exist
    const existing = await ctx.db.query("maintenanceItems").collect();

    if (existing.length > 0 && !args.force) {
      return {
        seeded: false,
        count: existing.length,
      };
    }

    // If force is true, clear existing items first
    if (args.force && existing.length > 0) {
      for (const item of existing) {
        await ctx.db.delete(item._id);
      }
    }

    // Insert all seed items
    for (const item of SEED_MAINTENANCE_ITEMS) {
      await ctx.db.insert("maintenanceItems", {
        name: item.name,
        category: item.category,
        intervalKm: item.intervalKm,
        intervalMonths: item.intervalMonths,
        description: item.description,
        serviceLevel: item.serviceLevel,
        notes: item.notes,
      });
    }

    return {
      seeded: true,
      count: SEED_MAINTENANCE_ITEMS.length,
    };
  },
});

/**
 * Query to check the current count of maintenance items in the database.
 */
export const getCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const items = await ctx.db.query("maintenanceItems").collect();
    return items.length;
  },
});
