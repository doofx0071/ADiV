// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("rides.logRide offline idempotency", () => {
  it("replays one summary safely and advances the single-bike odometer once", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ({ db }) => {
      await db.insert("bike", {
        name: "Honda ADV160",
        model: "ADV160 RoadSync",
        year: 2026,
        currentOdometer: 100,
        engineCc: 160,
        tireFront: "90/80-14",
        tireRear: "100/80-14",
        tirePressureFront: 29,
        tirePressureRear: 33,
        oilType: "10W-30",
        oilCapacity: 0.9,
        coolantCapacity: 0.8,
        batteryType: "12V",
        sparkPlugType: "CPR8EA-9",
        fuelTankCapacity: 8.1,
      });
    });

    const payload = {
      clientRideId: "ride-local-1",
      startOdometer: 100,
      endOdometer: 102.5,
      date: Date.now() - 10_000,
      startAt: Date.now() - 180_000,
      endAt: Date.now() - 10_000,
      source: "gps",
      trackedDistance: 2.5,
      maxSpeedKmh: 40,
      durationMinutes: 3,
      notes: "offline ride",
    };
    const firstId = await t.mutation(api.rides.logRide, payload);
    const retryId = await t.mutation(api.rides.logRide, payload);
    const rides = await t.query(api.rides.getRides, { limit: 10 });
    const bike = await t.run(async ({ db }) => (await db.query("bike").first())!);

    expect(retryId).toBe(firstId);
    expect(rides).toHaveLength(1);
    expect(rides[0].clientRideId).toBe("ride-local-1");
    expect(rides[0].route).toBeUndefined();
    expect(bike.currentOdometer).toBe(102.5);
  });

  it("rejects a reused client ride ID with different summary data", async () => {
    const t = convexTest(schema, modules);
    const payload = {
      clientRideId: "ride-local-2",
      startOdometer: 100,
      endOdometer: 102,
      date: Date.now() - 10_000,
      durationMinutes: 2,
      source: "gps",
      trackedDistance: 2,
    };
    await t.mutation(api.rides.logRide, payload);
    await expect(t.mutation(api.rides.logRide, { ...payload, endOdometer: 103 })).rejects.toThrow(
      "Client ride ID was already used for different ride data.",
    );
  });
});
