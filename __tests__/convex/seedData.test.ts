import { describe, it, expect } from "vitest";
import { SEED_MAINTENANCE_ITEMS } from "../../convex/seedData";

const VALID_CATEGORIES = [
  "engine",
  "transmission",
  "brakes",
  "tires",
  "electrical",
  "cooling",
  "chassis",
  "fuel",
  "general",
] as const;

const VALID_SERVICE_LEVELS = ["owner", "dealer"] as const;

describe("seedData", () => {
  it("exports exactly 25 maintenance items", () => {
    expect(SEED_MAINTENANCE_ITEMS.length).toBe(25);
  });

  it("all items have a non-empty name", () => {
    for (const item of SEED_MAINTENANCE_ITEMS) {
      expect(item.name).toBeDefined();
      expect(item.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("all items have a valid category", () => {
    for (const item of SEED_MAINTENANCE_ITEMS) {
      expect(VALID_CATEGORIES).toContain(item.category);
    }
  });

  it("all items have a valid serviceLevel", () => {
    for (const item of SEED_MAINTENANCE_ITEMS) {
      expect(VALID_SERVICE_LEVELS).toContain(item.serviceLevel);
    }
  });

  it("all items have intervalMonths as a positive number", () => {
    for (const item of SEED_MAINTENANCE_ITEMS) {
      expect(item.intervalMonths).toBeDefined();
      expect(item.intervalMonths).toBeGreaterThan(0);
    }
  });

  it("items with intervalKm have a positive number or zero", () => {
    for (const item of SEED_MAINTENANCE_ITEMS) {
      if (item.intervalKm !== undefined) {
        expect(item.intervalKm).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("all items have a non-empty description", () => {
    for (const item of SEED_MAINTENANCE_ITEMS) {
      expect(item.description).toBeDefined();
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("all item names are unique", () => {
    const names = SEED_MAINTENANCE_ITEMS.map((i) => i.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("contains all expected maintenance items by name", () => {
    const names = SEED_MAINTENANCE_ITEMS.map((i) => i.name);
    const expected = [
      "Engine Oil",
      "Oil Filter",
      "Spark Plug",
      "Valve Clearance",
      "Idle Speed",
      "Oil Strainer Screen",
      "Crankcase Breather",
      "Drive Belt (V-Belt)",
      "Rollers / Slide Piece",
      "Final Drive Oil",
      "Clutch Shoes Wear",
      "Brake System",
      "Tires",
      "Battery",
      "Lights, Signals & Horn",
      "Coolant",
      "Cooling System",
      "Fuel System (Injector)",
      "Fuel Line",
      "Air Cleaner Element",
      "Throttle Operation",
      "Side Stand",
      "Suspension",
      "Nuts & Bolts",
      "Steering Head Bearings",
    ];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });
});

describe("seedData - official Honda intervals", () => {
  // Spot-check key items for correct interval values
  const byName = (name: string) =>
    SEED_MAINTENANCE_ITEMS.find((i) => i.name === name)!;

  it("Engine Oil has 6000 km / 12 month interval", () => {
    const item = byName("Engine Oil");
    expect(item.intervalKm).toBe(6000);
    expect(item.intervalMonths).toBe(12);
  });

  it("Drive Belt has 12000 km / 12 month interval", () => {
    const item = byName("Drive Belt (V-Belt)");
    expect(item.intervalKm).toBe(12000);
    expect(item.intervalMonths).toBe(12);
  });

  it("Tires has 1000 km / 1 month interval", () => {
    const item = byName("Tires");
    expect(item.intervalKm).toBe(1000);
    expect(item.intervalMonths).toBe(1);
  });

  it("Coolant has no km interval and 36 month interval", () => {
    const item = byName("Coolant");
    expect(item.intervalKm).toBeUndefined();
    expect(item.intervalMonths).toBe(36);
  });

  it("Final Drive Oil has no km interval and 24 month interval", () => {
    const item = byName("Final Drive Oil");
    expect(item.intervalKm).toBeUndefined();
    expect(item.intervalMonths).toBe(24);
  });

  it("Steering Head Bearings has 24000 km / 24 month interval", () => {
    const item = byName("Steering Head Bearings");
    expect(item.intervalKm).toBe(24000);
    expect(item.intervalMonths).toBe(24);
  });

  it("Battery has 6000 km / 12 month interval", () => {
    const item = byName("Battery");
    expect(item.intervalKm).toBe(6000);
    expect(item.intervalMonths).toBe(12);
  });
});

describe("seedData - category distribution", () => {
  it("has items in every valid category", () => {
    const categories = SEED_MAINTENANCE_ITEMS.map((i) => i.category);
    for (const cat of VALID_CATEGORIES) {
      expect(categories).toContain(cat);
    }
  });

  it("engine has 7 items", () => {
    const count = SEED_MAINTENANCE_ITEMS.filter(
      (i) => i.category === "engine",
    ).length;
    expect(count).toBe(7);
  });

  it("transmission has 4 items", () => {
    const count = SEED_MAINTENANCE_ITEMS.filter(
      (i) => i.category === "transmission",
    ).length;
    expect(count).toBe(4);
  });

  it("chassis has 4 items", () => {
    const count = SEED_MAINTENANCE_ITEMS.filter(
      (i) => i.category === "chassis",
    ).length;
    expect(count).toBe(4);
  });

  it("each of brakes, tires has 1 item", () => {
    expect(
      SEED_MAINTENANCE_ITEMS.filter((i) => i.category === "brakes").length,
    ).toBe(1);
    expect(
      SEED_MAINTENANCE_ITEMS.filter((i) => i.category === "tires").length,
    ).toBe(1);
  });

  it("each of electrical, cooling, fuel, general has 2 items", () => {
    expect(
      SEED_MAINTENANCE_ITEMS.filter((i) => i.category === "electrical").length,
    ).toBe(2);
    expect(
      SEED_MAINTENANCE_ITEMS.filter((i) => i.category === "cooling").length,
    ).toBe(2);
    expect(
      SEED_MAINTENANCE_ITEMS.filter((i) => i.category === "fuel").length,
    ).toBe(2);
    expect(
      SEED_MAINTENANCE_ITEMS.filter((i) => i.category === "general").length,
    ).toBe(2);
  });
});
