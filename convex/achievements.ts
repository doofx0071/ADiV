import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { DatabaseReader } from "./_generated/server";
import { ACHIEVEMENT_DEFS, type AchievementType } from "../lib/achievements";
import { computeStreakStats } from "../lib/streak";
import { computeFuelInsights } from "../lib/fuel-insights";

export { ACHIEVEMENT_DEFS, type AchievementType };

interface AchievementMetrics {
  totalDistance: number;
  bestEfficiency: number;
  maintenanceLogCount: number;
  logsWithPhotos: number;
  expenseCount: number;
  totalExpenseAmount: number;
  streak: ReturnType<typeof computeStreakStats>;
}

/**
 * Collect every metric the achievement conditions depend on, in one pass.
 * Shared by checkAchievements and getAchievementProgress.
 */
async function collectAchievementMetrics(
  ctx: { db: DatabaseReader },
): Promise<AchievementMetrics> {
  const rides = await ctx.db.query("rides").collect();
  const totalDistance = rides.reduce((sum, r) => sum + r.distance, 0);

  const fuelLogs = await ctx.db.query("fuelLogs").collect();
  // Shared engine (lib/fuel-insights.ts): best efficiency over valid
  // full→full segments in date order — replaces the old per-pair loop that
  // ignored partial fills and back-filled dates.
  const bestEfficiency =
    computeFuelInsights(
      fuelLogs.map((log) => ({
        odometer: log.odometer,
        liters: log.liters,
        date: log.date,
        pricePerLiter: log.pricePerLiter,
        totalPrice: log.totalPrice,
        fullTank: log.fullTank,
      })),
      null,
    ).bestSegment?.kmL ?? 0;

  const maintenanceLogs = await ctx.db.query("maintenanceLogs").collect();
  const expenses = await ctx.db.query("expenses").collect();
  const maintenanceItems = await ctx.db.query("maintenanceItems").collect();

  const streak = computeStreakStats(
    maintenanceLogs.map((log) => ({
      itemId: log.itemId,
      odometer: log.odometer,
      date: log.date,
      nextDueOdometer: log.nextDueOdometer,
      nextDueDate: log.nextDueDate,
    })),
    maintenanceItems.map((item) => ({
      id: item._id,
      intervalKm: item.intervalKm,
      intervalMonths: item.intervalMonths,
    })),
  );

  return {
    totalDistance,
    bestEfficiency,
    maintenanceLogCount: maintenanceLogs.length,
    logsWithPhotos: maintenanceLogs.filter((l) => l.photos && l.photos.length > 0).length,
    expenseCount: expenses.length,
    totalExpenseAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
    streak,
  };
}

/** Current value of the metric behind an achievement type. */
function metricValue(type: AchievementType, m: AchievementMetrics): number {
  switch (type) {
    case "first_service":
    case "diy_mechanic":
      return m.maintenanceLogCount;
    case "streak_3":
    case "streak_5":
    case "streak_10":
      return m.streak.longestStreak;
    case "miles_100":
    case "miles_1000":
    case "miles_5000":
    case "mileage_10k":
    case "mileage_25k":
      return m.totalDistance;
    case "fuel_efficiency_25":
    case "fuel_efficiency_30":
    case "fuel_efficiency_40":
      return m.bestEfficiency;
    case "photo_logger":
      return m.logsWithPhotos;
    case "expense_tracker":
      return m.expenseCount;
    case "big_spender":
      return m.totalExpenseAmount;
    case "early_bird":
      return m.streak.earlyBirdCount;
  }
}

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

    const metrics = await collectAchievementMetrics(ctx);

    for (const def of ACHIEVEMENT_DEFS) {
      const met = metricValue(def.type, metrics) >= def.target;
      if (met && !existingTypes.has(def.type)) {
        await ctx.db.insert("achievements", {
          type: def.type,
          name: def.name,
          description: def.description,
          unlockedAt: Date.now(),
          icon: def.icon,
        });
        unlocked.push(def.type);
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

/**
 * Current progress toward every achievement, for locked-badge display.
 * Values are capped at the target so progress bars never overflow.
 */
export const getAchievementProgress = query({
  args: {},
  returns: v.array(
    v.object({
      type: v.string(),
      value: v.number(),
      target: v.number(),
    })
  ),
  handler: async (ctx) => {
    const metrics = await collectAchievementMetrics(ctx);
    return ACHIEVEMENT_DEFS.map((def) => {
      const raw = metricValue(def.type, metrics);
      const rounded =
        def.unit === "km/L" ? Math.round(raw * 10) / 10 : Math.round(raw);
      return {
        type: def.type,
        value: Math.min(rounded, def.target),
        target: def.target,
      };
    });
  },
});
