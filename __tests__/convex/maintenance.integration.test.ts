// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");

async function createBike(t: ReturnType<typeof convexTest>, currentOdometer: number) {
  return t.run((ctx) => ctx.db.insert("bike", {
    name: "ADiV",
    model: "Honda ADV160",
    year: 2024,
    currentOdometer,
    engineCc: 160,
    tireFront: "110/80-14",
    tireRear: "130/70-13",
    tirePressureFront: 29,
    tirePressureRear: 33,
    oilType: "10W-30",
    oilCapacity: 0.8,
    coolantCapacity: 0.8,
    batteryType: "YTZ6V",
    sparkPlugType: "CPR8EA-9",
    fuelTankCapacity: 8.1,
  }));
}

async function createMaintenanceItem(
  t: ReturnType<typeof convexTest>,
  lastServiceOdometer = 2_000,
  lastServiceDate = Date.now() - 30 * 24 * 60 * 60 * 1000
) {
  return t.run((ctx) => ctx.db.insert("maintenanceItems", {
    name: "Engine Oil",
    category: "engine",
    intervalKm: 1_000,
    intervalMonths: 6,
    lastServiceOdometer,
    lastServiceDate,
  }));
}

describe("maintenance readiness mutations", () => {
  it("records a confirmed history baseline and advances the bike odometer only when higher", async () => {
    const t = convexTest(schema, modules);
    const bikeId = await createBike(t, 5_000);
    const itemId = await createMaintenanceItem(t);
    const serviceDate = Date.now() - 7 * 24 * 60 * 60 * 1000;

    await t.mutation(api.maintenance.logMaintenance, {
      itemId,
      odometer: 3_500,
      date: serviceDate,
    });

    const { bike, item, logs } = await t.run(async (ctx) => ({
      bike: await ctx.db.get(bikeId),
      item: await ctx.db.get(itemId),
      logs: await ctx.db.query("maintenanceLogs").collect(),
    }));
    expect(item).toMatchObject({ lastServiceOdometer: 3_500, lastServiceDate: serviceDate });
    expect(bike?.currentOdometer).toBe(5_000);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      itemId,
      odometer: 3_500,
      date: serviceDate,
      nextDueOdometer: 4_500,
    });
  });

  it("advances the bike odometer when the confirmed service reading is higher", async () => {
    const t = convexTest(schema, modules);
    const bikeId = await createBike(t, 4_000);
    const itemId = await createMaintenanceItem(t);

    await t.mutation(api.maintenance.logMaintenance, {
      itemId,
      odometer: 4_500,
      date: Date.now() - 24 * 60 * 60 * 1000,
    });

    expect(await t.run(async (ctx) => (await ctx.db.get(bikeId))?.currentOdometer)).toBe(4_500);
  });

  it("updates the bike reading without creating a service log or changing item history", async () => {
    const t = convexTest(schema, modules);
    const bikeId = await createBike(t, 4_162.5);
    const lastServiceDate = Date.now() - 20 * 24 * 60 * 60 * 1000;
    const itemId = await createMaintenanceItem(t, 3_700, lastServiceDate);

    await t.mutation(api.bike.updateOdometer, { currentOdometer: 4_500 });

    const { bike, item, logs } = await t.run(async (ctx) => ({
      bike: await ctx.db.get(bikeId),
      item: await ctx.db.get(itemId),
      logs: await ctx.db.query("maintenanceLogs").collect(),
    }));
    expect(bike?.currentOdometer).toBe(4_500);
    expect(item).toMatchObject({ lastServiceOdometer: 3_700, lastServiceDate });
    expect(logs).toHaveLength(0);
  });
});
