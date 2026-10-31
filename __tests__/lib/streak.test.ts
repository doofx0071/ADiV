import { describe, expect, it } from "vitest";
import {
  computeStreakStats,
  EARLY_BIRD_MARGIN_KM,
  type StreakItemInput,
  type StreakLogInput,
} from "../../lib/streak";

const DAY = 24 * 60 * 60 * 1000;

function log(
  itemId: string,
  odometer: number,
  date: number,
  extra?: Partial<StreakLogInput>,
): StreakLogInput {
  return { itemId, odometer, date, ...extra };
}

function item(
  id: string,
  intervalKm?: number,
  intervalMonths?: number,
): StreakItemInput {
  return { id, intervalKm, intervalMonths };
}

describe("computeStreakStats", () => {
  it("returns zeros for no logs", () => {
    expect(computeStreakStats([], [])).toEqual({
      longestStreak: 0,
      currentStreak: 0,
      earlyBirdCount: 0,
    });
  });

  it("counts a single log as a streak of one", () => {
    const result = computeStreakStats([log("a", 1_000, 0)], [item("a")]);
    expect(result.longestStreak).toBe(1);
    expect(result.currentStreak).toBe(1);
    expect(result.earlyBirdCount).toBe(0);
  });

  it("treats the first log of an item as on-time but never early", () => {
    const result = computeStreakStats([log("a", 1_000, 0)], [item("a", 6_000)]);
    expect(result.longestStreak).toBe(1);
    expect(result.earlyBirdCount).toBe(0);
  });

  it("judges on-time against the stored nextDueOdometer snapshot", () => {
    const logs = [
      log("a", 1_000, 0 * DAY, { nextDueOdometer: 7_000 }),
      log("a", 6_500, 10 * DAY),
    ];
    const result = computeStreakStats(logs, [item("a")]);
    expect(result.longestStreak).toBe(2);
    expect(result.currentStreak).toBe(2);
  });

  it("breaks the streak when the odometer passes the stored due", () => {
    const logs = [
      log("a", 1_000, 0 * DAY, { nextDueOdometer: 7_000 }),
      log("a", 7_500, 10 * DAY),
    ];
    const result = computeStreakStats(logs, [item("a")]);
    expect(result.longestStreak).toBe(1);
    expect(result.currentStreak).toBe(0);
  });

  it("judges on-time against the stored nextDueDate snapshot", () => {
    const logs = [
      log("a", 1_000, 0 * DAY, { nextDueDate: 30 * DAY }),
      log("a", 2_000, 29 * DAY),
    ];
    const result = computeStreakStats(logs, [item("a")]);
    expect(result.longestStreak).toBe(2);
  });

  it("breaks the streak when the date passes the stored due even if odometer is fine", () => {
    const logs = [
      log("a", 1_000, 0 * DAY, { nextDueDate: 30 * DAY, nextDueOdometer: 7_000 }),
      log("a", 2_000, 31 * DAY),
    ];
    const result = computeStreakStats(logs, [item("a")]);
    expect(result.longestStreak).toBe(1);
    expect(result.currentStreak).toBe(0);
  });

  it("is late when either dimension is overdue", () => {
    const logs = [
      log("a", 1_000, 0 * DAY, { nextDueDate: 30 * DAY, nextDueOdometer: 7_000 }),
      log("a", 8_000, 5 * DAY),
    ];
    const result = computeStreakStats(logs, [item("a")]);
    expect(result.currentStreak).toBe(0);
  });

  it("falls back to the item intervalKm when no snapshot exists", () => {
    const logs = [log("a", 1_000, 0 * DAY), log("a", 6_000, 10 * DAY)];
    const result = computeStreakStats(logs, [item("a", 6_000)]);
    expect(result.longestStreak).toBe(2);
  });

  it("falls back to the item intervalMonths (30-day months) when no snapshot exists", () => {
    const logs = [log("a", 1_000, 0 * DAY), log("a", 1_500, 180 * DAY)];
    expect(computeStreakStats(logs, [item("a", undefined, 6)]).longestStreak).toBe(2);

    const late = [log("a", 1_000, 0 * DAY), log("a", 1_500, 181 * DAY)];
    expect(computeStreakStats(late, [item("a", undefined, 6)]).currentStreak).toBe(0);
  });

  it("prefers stored snapshots over the interval-derived fallback", () => {
    // Snapshot says due at 8,000 km; fallback from intervalKm would say 7,000.
    const logs = [
      log("a", 1_000, 0 * DAY, { nextDueOdometer: 8_000 }),
      log("a", 7_500, 10 * DAY),
    ];
    const result = computeStreakStats(logs, [item("a", 6_000)]);
    expect(result.currentStreak).toBe(2);
  });

  it("treats logs without any computable deadline as on-time", () => {
    const logs = [log("a", 1_000, 0 * DAY), log("a", 50_000, 400 * DAY)];
    const result = computeStreakStats(logs, [item("a")]);
    expect(result.longestStreak).toBe(2);
  });

  describe("early bird", () => {
    it("counts services logged 500+ km before due", () => {
      const logs = [
        log("a", 1_000, 0 * DAY, { nextDueOdometer: 7_000 }),
        log("a", 6_000, 5 * DAY), // 1,000 km early
      ];
      expect(computeStreakStats(logs, [item("a")]).earlyBirdCount).toBe(1);
    });

    it("counts the exact 500 km margin", () => {
      const logs = [
        log("a", 1_000, 0 * DAY, { nextDueOdometer: 7_000 }),
        log("a", 7_000 - EARLY_BIRD_MARGIN_KM, 5 * DAY),
      ];
      expect(computeStreakStats(logs, [item("a")]).earlyBirdCount).toBe(1);
    });

    it("does not count margins under 500 km", () => {
      const logs = [
        log("a", 1_000, 0 * DAY, { nextDueOdometer: 7_000 }),
        log("a", 6_550, 5 * DAY), // 450 km early
      ];
      expect(computeStreakStats(logs, [item("a")]).earlyBirdCount).toBe(0);
    });

    it("does not count late services even with a large odometer gap", () => {
      const logs = [
        log("a", 1_000, 0 * DAY, { nextDueDate: 30 * DAY }),
        log("a", 100, 60 * DAY), // odometer far below due, but date is late
      ];
      const result = computeStreakStats(logs, [item("a")]);
      expect(result.earlyBirdCount).toBe(0);
      expect(result.currentStreak).toBe(0);
    });
  });

  describe("global chronological merge", () => {
    it("merges all items into one timeline and breaks on any late service", () => {
      // Item A: 3 on-time logs (first + two unjudgeable). Item B: second log late.
      const logs = [
        log("a", 1_000, 1 * DAY),
        log("b", 1_000, 2 * DAY),
        log("a", 2_000, 3 * DAY),
        log("b", 9_000, 4 * DAY), // late vs b's stored due
        log("a", 3_000, 5 * DAY),
      ];
      const items = [
        item("a"),
        item("b"),
      ];
      // Give b a stored due so its second log is judged late
      const bFirst = logs.find((l) => l.itemId === "b")!;
      bFirst.nextDueOdometer = 5_000;

      const result = computeStreakStats(logs, items);
      // Timeline: a(1)on, b(2)on, a(3)on, b(4)LATE, a(5)on → longest 3, current 1
      expect(result.longestStreak).toBe(3);
      expect(result.currentStreak).toBe(1);
    });

    it("keeps separate items' judgments independent", () => {
      // Item a on-time; item b late — a's streak is unaffected for its own logs
      const logs = [
        log("a", 1_000, 1 * DAY, { nextDueOdometer: 7_000 }),
        log("a", 6_000, 2 * DAY),
        log("b", 1_000, 3 * DAY, { nextDueOdometer: 2_000 }),
        log("b", 9_000, 4 * DAY),
      ];
      const result = computeStreakStats(logs, [item("a"), item("b")]);
      // Timeline: a1on, a2on, b1on, b2late → longest 3, current 0
      expect(result.longestStreak).toBe(3);
      expect(result.currentStreak).toBe(0);
    });
  });
});
