import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Schema structural tests.
 *
 * Convex schema files are declarative configuration consumed by the Convex
 * codegen/build toolchain at compile time, not runtime.  Rather than import
 * `convex/server` (which pulls in un-runnable Node dependencies), we verify
 * the schema source file contains the expected table definitions, field
 * validators, and indexes via static analysis.
 */

const schemaPath = path.resolve(__dirname, "../convex/schema.ts");
const schemaSource = fs.readFileSync(schemaPath, "utf-8");

describe("convex/schema.ts", () => {
  // ── Table Existence ──────────────────────────────────────────────

  const expectedTables = [
    "bike",
    "maintenanceItems",
    "maintenanceLogs",
    "rides",
    "fuelLogs",
    "expenses",
    "files",
    "achievements",
  ] as const;

  for (const table of expectedTables) {
    it(`defines the "${table}" table`, () => {
      // Each table is defined as:  tableName: defineTable({ ... })
      const regex = new RegExp(
        `\\s{2}${table}:\\s*defineTable\\(\\{`,
        "g",
      );
      const matches = schemaSource.match(regex);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(1);
    });
  }

  // ── Index Existence ──────────────────────────────────────────────

  const expectedIndexes: { table: string; indexName: string; fields: string[] }[] = [
    { table: "maintenanceLogs", indexName: "by_item", fields: ["itemId"] },
    { table: "maintenanceLogs", indexName: "by_date", fields: ["date"] },
    { table: "rides", indexName: "by_date", fields: ["date"] },
    { table: "fuelLogs", indexName: "by_date", fields: ["date"] },
    { table: "files", indexName: "by_record", fields: ["recordType", "recordId"] },
  ];

  for (const idx of expectedIndexes) {
    it(`defines index "${idx.indexName}" on "${idx.table}" with fields [${idx.fields.join(", ")}]`, () => {
      // Index pattern: .index("by_xxx", ["field1", "field2"])
      const escapedFields = idx.fields.map((f) => `"${f}"`).join(", ");
      const pattern = `.index("${idx.indexName}", [${escapedFields}])`;
      expect(schemaSource).toContain(pattern);
    });
  }

  // ── Bike Table Fields ────────────────────────────────────────────

  it("bike table has all required fields with correct validators", () => {
    const bikeFields = extractTableBlock("bike");

    expect(bikeFields).toContain("name: v.string()");
    expect(bikeFields).toContain("model: v.string()");
    expect(bikeFields).toContain("year: v.number()");
    expect(bikeFields).toContain("color: v.optional(v.string())");
    expect(bikeFields).toContain("vin: v.optional(v.string())");
    expect(bikeFields).toContain("purchaseDate: v.optional(v.number())");
    expect(bikeFields).toContain("lastServiceDate: v.optional(v.number())");
    expect(bikeFields).toContain("currentOdometer: v.number()");
    expect(bikeFields).toContain("engineCc: v.number()");
    expect(bikeFields).toContain("tireFront: v.string()");
    expect(bikeFields).toContain("tireRear: v.string()");
    expect(bikeFields).toContain("tirePressureFront: v.number()");
    expect(bikeFields).toContain("tirePressureRear: v.number()");
    expect(bikeFields).toContain("oilType: v.string()");
    expect(bikeFields).toContain("oilCapacity: v.number()");
    expect(bikeFields).toContain("coolantCapacity: v.number()");
    expect(bikeFields).toContain("batteryType: v.string()");
    expect(bikeFields).toContain("sparkPlugType: v.string()");
    expect(bikeFields).toContain("fuelTankCapacity: v.number()");
    expect(bikeFields).toContain("notes: v.optional(v.string())");
  });

  // ── Maintenance Items Fields ─────────────────────────────────────

  it("maintenanceItems table has all required fields", () => {
    const fields = extractTableBlock("maintenanceItems");

    expect(fields).toContain("name: v.string()");
    expect(fields).toContain("category: v.string()");
    expect(fields).toContain("intervalKm: v.optional(v.number())");
    expect(fields).toContain("intervalMonths: v.number()");
    expect(fields).toContain("description: v.optional(v.string())");
    expect(fields).toContain("serviceLevel: v.optional(v.string())");
    expect(fields).toContain("notes: v.optional(v.string())");
    expect(fields).toContain("icon: v.optional(v.string())");
    expect(fields).toContain("partNumber: v.optional(v.string())");
    expect(fields).toContain("quantity: v.optional(v.number())");
  });

  // ── Maintenance Logs Fields ──────────────────────────────────────

  it("maintenanceLogs table has all required fields", () => {
    const fields = extractTableBlock("maintenanceLogs");

    expect(fields).toContain("itemId: v.id(\"maintenanceItems\")");
    expect(fields).toContain("odometer: v.number()");
    expect(fields).toContain("date: v.number()");
    expect(fields).toContain("cost: v.optional(v.number())");
    expect(fields).toContain("notes: v.optional(v.string())");
    expect(fields).toContain("nextDueOdometer: v.optional(v.number())");
    expect(fields).toContain("nextDueDate: v.optional(v.number())");
    expect(fields).toContain("photos: v.optional(v.array(v.string()))");
  });

  // ── Rides Fields ─────────────────────────────────────────────────

  it("rides table has all required fields", () => {
    const fields = extractTableBlock("rides");

    expect(fields).toContain("startOdometer: v.number()");
    expect(fields).toContain("endOdometer: v.number()");
    expect(fields).toContain("distance: v.number()");
    expect(fields).toContain("date: v.number()");
    expect(fields).toContain("durationMinutes: v.number()");
    expect(fields).toContain("notes: v.optional(v.string())");
  });

  // ── Fuel Logs Fields ─────────────────────────────────────────────

  it("fuelLogs table has all required fields", () => {
    const fields = extractTableBlock("fuelLogs");

    expect(fields).toContain("odometer: v.number()");
    expect(fields).toContain("liters: v.number()");
    expect(fields).toContain("pricePerLiter: v.number()");
    expect(fields).toContain("totalPrice: v.number()");
    expect(fields).toContain("date: v.number()");
    expect(fields).toContain("stationName: v.optional(v.string())");
    expect(fields).toContain("notes: v.optional(v.string())");
  });

  // ── Expenses Fields ──────────────────────────────────────────────

  it("expenses table has all required fields", () => {
    const fields = extractTableBlock("expenses");

    expect(fields).toContain("category: v.string()");
    expect(fields).toContain("amount: v.number()");
    expect(fields).toContain("date: v.number()");
    expect(fields).toContain("description: v.optional(v.string())");
    expect(fields).toContain("receiptPhoto: v.optional(v.string())");
  });

  // ── Files Fields ─────────────────────────────────────────────────

  it("files table has all required fields", () => {
    const fields = extractTableBlock("files");

    expect(fields).toContain("storageId: v.string()");
    expect(fields).toContain("name: v.string()");
    expect(fields).toContain("type: v.string()");
    expect(fields).toContain("size: v.number()");
    expect(fields).toContain("recordType: v.string()");
    expect(fields).toContain("recordId: v.string()");
    expect(fields).toContain("createdAt: v.number()");
  });

  // ── Achievements Fields ──────────────────────────────────────────

  it("achievements table has all required fields", () => {
    const fields = extractTableBlock("achievements");

    expect(fields).toContain("type: v.string()");
    expect(fields).toContain("name: v.string()");
    expect(fields).toContain("description: v.optional(v.string())");
    expect(fields).toContain("unlockedAt: v.number()");
    expect(fields).toContain("icon: v.optional(v.string())");
  });

  // ── No Forbidden Elements ────────────────────────────────────────

  it("does NOT contain bikeId or multi-bike references", () => {
    // Single-bike app — no bikeId foreign keys anywhere
    const lines = schemaSource.split("\n");
    const bikeIdLines = lines.filter(
      (l) => l.includes("bikeId") && !l.trim().startsWith("//"),
    );
    expect(bikeIdLines).toHaveLength(0);
  });
});

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Extract the field-definition block inside a defineTable() call for the
 * given table name.  Returns the raw text of the block, or empty string
 * if the table is not found.
 */
function extractTableBlock(tableName: string): string {
  // Match: <spaces>tableName: defineTable({ ...fields... })
  const startMarker = `  ${tableName}: defineTable({`;
  const startIdx = schemaSource.indexOf(startMarker);
  if (startIdx === -1) return "";

  // Search forward from the opening `{` of defineTable
  const blockStart = schemaSource.indexOf("{", startIdx) + 1;
  if (blockStart === 0) return "";

  // Track brace depth to find the matching `}`
  let depth = 1;
  let pos = blockStart;
  while (depth > 0 && pos < schemaSource.length) {
    const ch = schemaSource[pos];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    pos++;
  }

  // Return the content between the braces (trimmed)
  return schemaSource.slice(blockStart, pos - 1).trim();
}
