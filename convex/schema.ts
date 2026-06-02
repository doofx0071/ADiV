import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * AdiV — Motorcycle Maintenance Tracker Schema
 *
 * Single-bike architecture (no per-bike foreign keys).
 * All timestamps are milliseconds since epoch (Date.now()).
 */
export default defineSchema({
  // ── Bike Profile ──────────────────────────────────────────────────
  // Single document: the user's motorcycle. Fields cover specs,
  // consumables, and maintenance reference data.
  bike: defineTable({
    name: v.string(),
    model: v.string(),
    year: v.number(),
    color: v.optional(v.string()),
    vin: v.optional(v.string()),
    purchaseDate: v.optional(v.number()),
    lastServiceDate: v.optional(v.number()),
    currentOdometer: v.number(),
    engineCc: v.number(),
    tireFront: v.string(),
    tireRear: v.string(),
    tirePressureFront: v.number(),
    tirePressureRear: v.number(),
    oilType: v.string(),
    oilCapacity: v.number(),
    coolantCapacity: v.number(),
    batteryType: v.string(),
    sparkPlugType: v.string(),
    fuelTankCapacity: v.number(),
    notes: v.optional(v.string()),
  }),

  // ── Maintenance Template Items ────────────────────────────────────
  // Pre-defined and user-defined tasks that describe recurring
  // maintenance operations. Used as templates for maintenanceLogs.
  maintenanceItems: defineTable({
    name: v.string(),
    category: v.string(),
    intervalKm: v.optional(v.number()),
    intervalMonths: v.number(),
    description: v.optional(v.string()),
    serviceLevel: v.optional(v.string()),
    notes: v.optional(v.string()),
    icon: v.optional(v.string()),
    partNumber: v.optional(v.string()),
    quantity: v.optional(v.number()),
    lastServiceOdometer: v.optional(v.number()),
    lastServiceDate: v.optional(v.number()),
  }),

  // ── Maintenance Service Logs ──────────────────────────────────────
  // Records of actual maintenance work performed, referencing the
  // template item. Includes cost, odometer, and next-due tracking.
  maintenanceLogs: defineTable({
    itemId: v.id("maintenanceItems"),
    odometer: v.number(),
    date: v.number(),
    cost: v.optional(v.number()),
    notes: v.optional(v.string()),
    nextDueOdometer: v.optional(v.number()),
    nextDueDate: v.optional(v.number()),
    photos: v.optional(v.array(v.string())),
  })
    .index("by_item", ["itemId"])
    .index("by_date", ["date"]),

  // ── Ride Logs ─────────────────────────────────────────────────────
  // Track individual rides: distance, duration, route notes.
  rides: defineTable({
    startOdometer: v.number(),
    endOdometer: v.number(),
    distance: v.number(),
    date: v.number(),
    durationMinutes: v.number(),
    notes: v.optional(v.string()),
  }).index("by_date", ["date"]),

  // ── Fuel Logs ─────────────────────────────────────────────────────
  // Fuel-up records for tracking consumption and costs.
  fuelLogs: defineTable({
    odometer: v.number(),
    liters: v.number(),
    pricePerLiter: v.number(),
    totalPrice: v.number(),
    date: v.number(),
    stationName: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index("by_date", ["date"]),

  // ── General Expenses ──────────────────────────────────────────────
  // Non-fuel costs: parts, accessories, insurance, parking, etc.
  expenses: defineTable({
    category: v.string(),
    amount: v.number(),
    date: v.number(),
    description: v.optional(v.string()),
    receiptPhoto: v.optional(v.string()),
  }),

  // ── Uploaded Files ────────────────────────────────────────────────
  // Metadata for files stored in Convex file storage.
  // recordType + recordId form a polymorphic reference to any table.
  files: defineTable({
    storageId: v.string(),
    name: v.string(),
    type: v.string(),
    size: v.number(),
    recordType: v.string(),
    recordId: v.string(),
    createdAt: v.number(),
  }).index("by_record", ["recordType", "recordId"]),

  // ── Achievements / Badges ─────────────────────────────────────────
  // Unlockable badges for gamification (service milestones, distance
  // goals, fuel economy records, etc.).
  achievements: defineTable({
    type: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    unlockedAt: v.number(),
    icon: v.optional(v.string()),
  }),
});
