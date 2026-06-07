import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ACHIEVEMENT_DEFS, type AchievementType } from "../lib/achievements";

export { ACHIEVEMENT_DEFS, type AchievementType };

/**
 * Check and unlock achievements based on current stats.
 */
export const checkAchievements = mutation({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const unlocked: string[] = [];
    const existingAchievements = await ctx.db.query("achievements").collect();
    const existingTypes = new Set(existingAchievements.map((a) => a.type));

    // Get stats
    const rides = await ctx.db.query("rides").collect();
    const totalDistance = rides.reduce((sum, r) => sum + r.distance, 0);

    const fuelLogs = await ctx.db.query("fuelLogs").order("asc").collect();
    let bestEfficiency = 0;
    for (let i = 1; i < fuelLogs.length; i++) {
      const distance = fuelLogs[i].odometer - fuelLogs[i - 1].odometer;
      const efficiency = distance / fuelLogs[i].liters;
      if (efficiency > bestEfficiency) bestEfficiency = efficiency;
    }

    const maintenanceLogs = await ctx.db.query("maintenanceLogs").collect();
    const expenses = await ctx.db.query("expenses").collect();

    // Count logs with photos
    const logsWithPhotos = maintenanceLogs.filter((l) => l.photos && l.photos.length > 0).length;

    // Count on-time services (simplified: has at least one log)
    const maintenanceItems = await ctx.db.query("maintenanceItems").collect();
    const itemsServiced = maintenanceItems.filter((item) => item.lastServiceDate).length;

    const checks: { type: AchievementType; condition: boolean }[] = [
      { type: "first_service", condition: maintenanceLogs.length >= 1 },
      { type: "streak_3", condition: itemsServiced >= 3 },
      { type: "streak_10", condition: itemsServiced >= 10 },
      { type: "miles_100", condition: totalDistance >= 100 },
      { type: "miles_1000", condition: totalDistance >= 1000 },
      { type: "miles_5000", condition: totalDistance >= 5000 },
      { type: "fuel_efficiency_30", condition: bestEfficiency >= 30 },
      { type: "fuel_efficiency_40", condition: bestEfficiency >= 40 },
      { type: "photo_logger", condition: logsWithPhotos >= 5 },
      { type: "expense_tracker", condition: expenses.length >= 10 },
    ];

    for (const check of checks) {
      if (check.condition && !existingTypes.has(check.type)) {
        const def = ACHIEVEMENT_DEFS.find((d) => d.type === check.type);
        if (def) {
          await ctx.db.insert("achievements", {
            type: check.type,
            name: def.name,
            description: def.description,
            unlockedAt: Date.now(),
            icon: def.icon,
          });
          unlocked.push(check.type);
        }
      }
    }

    return unlocked;
  },
});

/**
 * Get all unlocked achievements.
 */
export const getAchievements = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("achievements"),
      _creationTime: v.number(),
      type: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      unlockedAt: v.number(),
      icon: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("achievements").order("desc").collect();
  },
});

/**
 * Get achievement stats.
 */
export const getAchievementStats = query({
  args: {},
  returns: v.object({
    unlocked: v.number(),
    total: v.number(),
    percent: v.number(),
  }),
  handler: async (ctx) => {
    const achievements = await ctx.db.query("achievements").collect();
    const total = ACHIEVEMENT_DEFS.length;
    return {
      unlocked: achievements.length,
      total,
      percent: Math.round((achievements.length / total) * 100),
    };
  },
});
