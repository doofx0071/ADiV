// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

async function createItem(
  t: ReturnType<typeof convexTest>,
  intervalKm = 6_000,
  intervalMonths = 12,
) {
  return t.run((ctx) =>
    ctx.db.insert("maintenanceItems", {
      name: "Engine Oil",
      category: "engine",
      intervalKm,
      intervalMonths,
    })
  );
}

describe("achievements", () => {
  it("unlocks first_service and streak_3 for consecutive on-time services", async () => {
    const t = convexTest(schema, modules);
    const itemId = await createItem(t);

    // Each service lands before the previous log's 6,000 km nextDue snapshot
    await t.mutation(api.maintenance.logMaintenance, {
      itemId, odometer: 1_000, date: now - 90 * DAY,
    });
    await t.mutation(api.maintenance.logMaintenance, {
      itemId, odometer: 6_000, date: now - 60 * DAY,
    });
    await t.mutation(api.maintenance.logMaintenance, {
      itemId, odometer: 11_000, date: now - 30 * DAY,
    });

    const unlocked = await t.mutation(api.achievements.checkAchievements, {});
    expect(unlocked).toContain("first_service");
    expect(unlocked).toContain("streak_3");
    expect(unlocked).not.toContain("streak_5");
    // Idempotent: a second check unlocks nothing new
    const again = await t.mutation(api.achievements.checkAchievements, {});
    expect(again).toEqual([]);
  });

  it("unlocks streak_5 and early_bird when services land 500+ km early", async () => {
    const t = convexTest(schema, modules);
    const itemId = await createItem(t);

    // Each service is 1,000 km before its due (5,000 < 7,000, etc.)
    const odometers = [1_000, 6_000, 11_000, 16_000, 21_000, 26_000];
    for (let i = 0; i < odometers.length; i++) {
      await t.mutation(api.maintenance.logMaintenance, {
        itemId,
        odometer: odometers[i],
        date: now - (90 - i * 10) * DAY,
      });
    }

    const unlocked = await t.mutation(api.achievements.checkAchievements, {});
    expect(unlocked).toContain("streak_5");
    expect(unlocked).toContain("early_bird");
    expect(unlocked).not.toContain("streak_10");
  });

  it("does not unlock streak achievements when a service is late", async () => {
    const t = convexTest(schema, modules);
    const itemId = await createItem(t);

    await t.mutation(api.maintenance.logMaintenance, {
      itemId, odometer: 1_000, date: now - 90 * DAY,
    });
    // 8,000 km is past the 7,000 km due from the first log
    await t.mutation(api.maintenance.logMaintenance, {
      itemId, odometer: 8_000, date: now - 30 * DAY,
    });

    const unlocked = await t.mutation(api.achievements.checkAchievements, {});
    expect(unlocked).toContain("first_service");
    expect(unlocked).not.toContain("streak_3");
  });

  it("unlocks big_spender once expenses pass ₱50,000", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.expenses.addExpense, {
      category: "Parts", amount: 30_000, date: now - DAY,
    });
    const first = await t.mutation(api.achievements.checkAchievements, {});
    expect(first).not.toContain("big_spender");

    await t.mutation(api.expenses.addExpense, {
      category: "Accessories", amount: 20_000, date: now - DAY,
    });
    const second = await t.mutation(api.achievements.checkAchievements, {});
    expect(second).toContain("big_spender");
  });

  it("unlocks diy_mechanic at 10 logged services", async () => {
    const t = convexTest(schema, modules);
    const itemId = await createItem(t);

    for (let i = 0; i < 9; i++) {
      await t.mutation(api.maintenance.logMaintenance, {
        itemId,
        odometer: 1_000 + i * 1_000,
        date: now - (100 - i * 5) * DAY,
      });
    }
    const before = await t.mutation(api.achievements.checkAchievements, {});
    expect(before).not.toContain("diy_mechanic");

    await t.mutation(api.maintenance.logMaintenance, {
      itemId, odometer: 10_000, date: now - 2 * DAY,
    });
    const after = await t.mutation(api.achievements.checkAchievements, {});
    expect(after).toContain("diy_mechanic");
  });

  it("reports capped per-badge progress values", async () => {
    const t = convexTest(schema, modules);
    const itemId = await createItem(t);

    await t.mutation(api.maintenance.logMaintenance, {
      itemId, odometer: 1_000, date: now - 10 * DAY,
    });

    const progress = await t.query(api.achievements.getAchievementProgress, {});
    expect(progress.find((p) => p.type === "first_service")).toMatchObject({
      value: 1,
      target: 1,
    });
    expect(progress.find((p) => p.type === "diy_mechanic")).toMatchObject({
      value: 1,
      target: 10,
    });
    expect(progress.find((p) => p.type === "miles_5000")).toMatchObject({
      value: 0,
      target: 5000,
    });
    expect(progress).toHaveLength(17);
  });
});
