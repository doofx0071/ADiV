import { describe, expect, it } from "vitest";
import { computeFuelInsights, type FuelLogInput } from "../../lib/fuel-insights";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 30 * DAY; // fixed "today" for deterministic day math

function log(overrides: Partial<FuelLogInput> & { odometer: number; date: number }): FuelLogInput {
  return {
    liters: 4,
    pricePerLiter: 60,
    totalPrice: 240,
    ...overrides,
  };
}

describe("computeFuelInsights", () => {
  it("returns zeros for no logs", () => {
    const result = computeFuelInsights([], 8.1, NOW);
    expect(result.refuelCount).toBe(0);
    expect(result.avgKmPerLiter).toBe(0);
    expect(result.bestSegment).toBeNull();
    expect(result.tankRangeKm).toBe(0);
    expect(result.stationStats).toEqual([]);
    expect(result.monthlySpend).toEqual([]);
  });

  it("treats a single log as baseline with no segments", () => {
    const result = computeFuelInsights([log({ odometer: 1000, date: 0 })], 8.1, NOW);
    expect(result.refuelCount).toBe(1);
    expect(result.validSegments).toHaveLength(0);
    expect(result.avgKmPerLiter).toBe(0);
    expect(result.daysSinceLastRefuel).toBe(30);
  });

  it("computes a valid full→full segment as distance / liters added", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 1000, date: 0, liters: 5 }), // baseline fill
        log({ odometer: 1400, date: 4 * DAY, liters: 4 }), // full fill closes the segment
      ],
      8.1,
      NOW,
    );
    expect(result.validSegments).toHaveLength(1);
    expect(result.validSegments[0].kmL).toBeCloseTo(100); // 400 km / 4 L — unrealistic but exact
    expect(result.avgKmPerLiter).toBeCloseTo(100);
  });

  it("merges partial fills into the closing full→full segment", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 1000, date: 0 }), // full (default)
        log({ odometer: 1400, date: 4 * DAY, fullTank: false, liters: 2 }), // partial
        log({ odometer: 1800, date: 8 * DAY, liters: 4 }), // full closes the window
      ],
      8.1,
      NOW,
    );
    // Window 1000→1800: all liters since the opening full fill (2 + 4 = 6)
    expect(result.validSegments).toHaveLength(1);
    expect(result.validSegments[0].distanceKm).toBe(800);
    expect(result.validSegments[0].liters).toBe(6);
    expect(result.validSegments[0].kmL).toBeCloseTo(800 / 6);
  });

  it("merges multiple consecutive partials into one window", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 1000, date: 0 }),
        log({ odometer: 1200, date: 2 * DAY, fullTank: false, liters: 1 }),
        log({ odometer: 1400, date: 4 * DAY, fullTank: false, liters: 2 }),
        log({ odometer: 1800, date: 6 * DAY, liters: 4 }),
      ],
      8.1,
      NOW,
    );
    expect(result.validSegments).toHaveLength(1);
    expect(result.validSegments[0].liters).toBe(7);
    expect(result.validSegments[0].kmL).toBeCloseTo(800 / 7);
  });

  it("excludes the last full fill until the next fill closes it", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 0, date: 0 }),
        log({ odometer: 400, date: 4 * DAY }),
      ],
      8.1,
      NOW,
    );
    // 400 km / 4 L IS valid here — the later fill (date 4d) closes the segment
    expect(result.validSegments).toHaveLength(1);
  });

  it("sorts by date, not insertion order (back-filled logs)", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 1800, date: 8 * DAY, liters: 4 }), // inserted first, later date
        log({ odometer: 1000, date: 0, liters: 5 }), // back-filled older log
      ],
      8.1,
      NOW,
    );
    expect(result.validSegments).toHaveLength(1);
    expect(result.validSegments[0].distanceKm).toBe(800);
    expect(result.priceSeries[0].date).toBe(0);
  });

  it("drops non-positive odometer deltas", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 1000, date: 0 }),
        log({ odometer: 1000, date: DAY }), // same odometer → no distance
        log({ odometer: 1400, date: 2 * DAY }),
      ],
      8.1,
      NOW,
    );
    expect(result.validSegments).toHaveLength(1);
    expect(result.validSegments[0].distanceKm).toBe(400);
  });

  it("reports best and worst segments", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 0, date: 0 }),
        log({ odometer: 400, date: 2 * DAY, liters: 4 }), // 100 km/L
        log({ odometer: 1000, date: 4 * DAY, liters: 4 }), // 150 km/L
        log({ odometer: 1600, date: 6 * DAY, liters: 5 }), // 120 km/L
      ],
      8.1,
      NOW,
    );
    expect(result.bestSegment?.kmL).toBeCloseTo(150);
    expect(result.worstSegment?.kmL).toBeCloseTo(100);
    // Distance-weighted average: (400+600+600)/(4+4+5) = 1600/13
    expect(result.avgKmPerLiter).toBeCloseTo(1600 / 13);
  });

  it("computes cost per km from segment costs", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 0, date: 0, pricePerLiter: 60, liters: 4, totalPrice: 240 }),
        log({ odometer: 400, date: 2 * DAY, pricePerLiter: 60, liters: 4, totalPrice: 240 }),
      ],
      8.1,
      NOW,
    );
    // 240 cost / 400 km
    expect(result.costPerKm).toBeCloseTo(0.6);
  });

  it("estimates tank range from average efficiency and capacity", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 0, date: 0 }),
        log({ odometer: 400, date: 2 * DAY, liters: 4 }), // 100 km/L
      ],
      8.1,
      NOW,
    );
    expect(result.tankRangeKm).toBeCloseTo(810);
  });

  it("gives no range without tank data", () => {
    const result = computeFuelInsights(
      [log({ odometer: 0, date: 0 }), log({ odometer: 400, date: 2 * DAY })],
      null,
      NOW,
    );
    expect(result.tankRangeKm).toBe(0);
  });

  it("computes refuel cadence and liters per refuel over all logs", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 0, date: 0, liters: 3, fullTank: false }),
        log({ odometer: 400, date: 4 * DAY, liters: 5 }),
        log({ odometer: 800, date: 12 * DAY, liters: 4 }),
      ],
      8.1,
      12 * DAY, // now = last refuel
    );
    // Gaps: 4d and 8d → average 6
    expect(result.avgDaysBetweenRefuels).toBeCloseTo(6);
    expect(result.avgLitersPerRefuel).toBeCloseTo(4); // 12 L / 3 refuels
    expect(result.daysSinceLastRefuel).toBe(0);
  });

  it("buckets monthly spend across months", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 0, date: new Date("2026-09-15").getTime() }),
        log({ odometer: 400, date: new Date("2026-09-28").getTime() }),
        log({ odometer: 800, date: new Date("2026-10-10").getTime() }),
      ],
      8.1,
      NOW,
    );
    expect(result.monthlySpend).toEqual([
      { key: "2026-09", spend: 480 },
      { key: "2026-10", spend: 240 },
    ]);
  });

  it("aggregates station stats cheapest-first, skipping unnamed stations", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 0, date: 0, stationName: "Shell", pricePerLiter: 62, liters: 4, totalPrice: 248 }),
        log({ odometer: 400, date: 2 * DAY, stationName: "Petron", pricePerLiter: 58, liters: 4, totalPrice: 232 }),
        log({ odometer: 800, date: 4 * DAY, pricePerLiter: 60, liters: 4, totalPrice: 240 }),
        log({ odometer: 1200, date: 6 * DAY, stationName: "Shell", pricePerLiter: 64, liters: 4, totalPrice: 256 }),
      ],
      8.1,
      NOW,
    );
    expect(result.stationStats).toHaveLength(2);
    expect(result.stationStats[0].station).toBe("Petron");
    expect(result.stationStats[0].avgPricePerLiter).toBeCloseTo(58);
    expect(result.stationStats[1].station).toBe("Shell");
    expect(result.stationStats[1].visits).toBe(2);
    expect(result.stationStats[1].avgPricePerLiter).toBeCloseTo(63); // (248+256)/8
  });

  it("treats legacy logs (no fullTank flag) as full fills", () => {
    const result = computeFuelInsights(
      [
        log({ odometer: 0, date: 0, fullTank: undefined }),
        log({ odometer: 400, date: 2 * DAY, fullTank: undefined }),
      ],
      8.1,
      NOW,
    );
    expect(result.validSegments).toHaveLength(1);
  });
});
