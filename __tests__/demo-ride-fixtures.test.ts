import { describe, expect, it } from "vitest";
import { demoModeForRideId, createDemoRideFixtures } from "../mobile/src/lib/demo-ride-fixtures";

describe("local demo ride fixtures", () => {
  it("provides distinct Record Only and Navigate + Record tracks around Davao", () => {
    const fixtures = createDemoRideFixtures(1_800_000_000_000);

    expect(fixtures.map((ride) => ride.demoMode)).toEqual(["recordOnly", "navigateAndRecord"]);
    for (const ride of fixtures) {
      expect(ride.points.length).toBeGreaterThanOrEqual(2);
      expect(new Set(ride.points.map((point) => `${point.lon},${point.lat}`)).size).toBeGreaterThan(1);
      expect(ride.points[0].lat).toBeGreaterThan(6.8);
      expect(ride.points[0].lat).toBeLessThan(7.3);
      expect(ride.points[0].lon).toBeGreaterThan(125.4);
      expect(ride.points[0].lon).toBeLessThan(125.8);
      expect(ride.summary.trackedDistance).toBeGreaterThan(0);
      expect(ride.syncState).toBe("local_only");
      expect(ride.serverRideId).toBeNull();
    }
  });

  it("identifies only the built-in sample IDs", () => {
    const [recordOnly, navigateAndRecord] = createDemoRideFixtures();
    expect(demoModeForRideId(recordOnly.id)).toBe("recordOnly");
    expect(demoModeForRideId(navigateAndRecord.id)).toBe("navigateAndRecord");
    expect(demoModeForRideId("ride-real-user-data")).toBeNull();
  });
});
