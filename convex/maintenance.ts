import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Query all maintenance items ordered by category then name.
 */
export const getMaintenanceItems = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("maintenanceItems"),
      _creationTime: v.number(),
      name: v.string(),
      category: v.string(),
      intervalKm: v.optional(v.number()),
      intervalMonths: v.optional(v.number()),
      intervalSource: v.optional(v.string()),
      description: v.optional(v.string()),
      serviceLevel: v.optional(v.string()),
      notes: v.optional(v.string()),
      lastServiceOdometer: v.optional(v.number()),
      lastServiceDate: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    const items = await ctx.db.query("maintenanceItems").collect();
    return items.sort(
      (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
  },
});

function cleanOptionalText(value?: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

function validateMaintenanceItem(args: {
  name: string;
  category: string;
  intervalKm?: number;
  intervalMonths?: number;
  intervalSource?: string;
}) {
  if (!args.name.trim()) throw new Error("Maintenance item name is required");
  if (!args.category.trim()) throw new Error("Maintenance category is required");
  if (args.name.trim().length > 120) throw new Error("Maintenance item name must be 120 characters or fewer");
  if (args.category.trim().length > 60) throw new Error("Maintenance category must be 60 characters or fewer");
  if (args.intervalSource && args.intervalSource.trim().length > 300) {
    throw new Error("Interval source must be 300 characters or fewer");
  }
  if (args.intervalKm !== undefined && (!Number.isInteger(args.intervalKm) || args.intervalKm <= 0)) {
    throw new Error("Distance interval must be a positive whole number of kilometers");
  }
  if (args.intervalMonths !== undefined && (!Number.isInteger(args.intervalMonths) || args.intervalMonths <= 0)) {
    throw new Error("Time interval must be a positive whole number of months");
  }
}

/** Create a user-editable maintenance schedule item. */
export const createMaintenanceItem = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    intervalKm: v.optional(v.number()),
    intervalMonths: v.optional(v.number()),
    intervalSource: v.optional(v.string()),
    description: v.optional(v.string()),
    serviceLevel: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("maintenanceItems"),
  handler: async (ctx, args) => {
    validateMaintenanceItem(args);
    return ctx.db.insert("maintenanceItems", {
      name: args.name.trim(),
      category: args.category.trim().toLowerCase(),
      intervalKm: args.intervalKm,
      intervalMonths: args.intervalMonths,
      intervalSource: cleanOptionalText(args.intervalSource),
      description: cleanOptionalText(args.description),
      serviceLevel: cleanOptionalText(args.serviceLevel),
      notes: cleanOptionalText(args.notes),
    });
  },
});

/** Update schedule details without changing the item's confirmed service baseline. */
export const updateMaintenanceItem = mutation({
  args: {
    itemId: v.id("maintenanceItems"),
    name: v.string(),
    category: v.string(),
    intervalKm: v.optional(v.number()),
    intervalMonths: v.optional(v.number()),
    intervalSource: v.optional(v.string()),
    description: v.optional(v.string()),
    serviceLevel: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Maintenance item not found");
    validateMaintenanceItem(args);
    await ctx.db.patch(args.itemId, {
      name: args.name.trim(),
      category: args.category.trim().toLowerCase(),
      intervalKm: args.intervalKm,
      intervalMonths: args.intervalMonths,
      intervalSource: cleanOptionalText(args.intervalSource),
      description: cleanOptionalText(args.description),
      serviceLevel: cleanOptionalText(args.serviceLevel),
      notes: cleanOptionalText(args.notes),
    });
    return null;
  },
});

/** Check whether a schedule item has service history before offering deletion. */
export const hasMaintenanceLogs = query({
  args: { itemId: v.id("maintenanceItems") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const log = await ctx.db
      .query("maintenanceLogs")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .first();
    return log !== null;
  },
});

/** Delete only unused schedule items; confirmed service history is preserved. */
export const deleteMaintenanceItem = mutation({
  args: { itemId: v.id("maintenanceItems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Maintenance item not found");
    const log = await ctx.db
      .query("maintenanceLogs")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .first();
    if (log) {
      throw new Error("This item has service history. Delete its service logs first to protect your records.");
    }
    await ctx.db.delete(args.itemId);
    return null;
  },
});

/**
 * Query maintenance logs for a specific item with pagination.
 */
export const getMaintenanceLogs = query({
  args: {
    itemId: v.id("maintenanceItems"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("maintenanceLogs"),
      _creationTime: v.number(),
      itemId: v.id("maintenanceItems"),
      itemName: v.optional(v.string()),
      odometer: v.number(),
      date: v.number(),
      cost: v.optional(v.number()),
      notes: v.optional(v.string()),
      nextDueOdometer: v.optional(v.number()),
      nextDueDate: v.optional(v.number()),
      photos: v.optional(v.array(v.id("_storage"))),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("maintenanceLogs")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Query all maintenance logs ordered by date desc.
 */
export const getAllMaintenanceLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("maintenanceLogs"),
      _creationTime: v.number(),
      itemId: v.id("maintenanceItems"),
      itemName: v.optional(v.string()),
      odometer: v.number(),
      date: v.number(),
      cost: v.optional(v.number()),
      notes: v.optional(v.string()),
      nextDueOdometer: v.optional(v.number()),
      nextDueDate: v.optional(v.number()),
      photos: v.optional(v.array(v.id("_storage"))),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("maintenanceLogs")
      .withIndex("by_date", (q) => q)
      .order("desc")
      .take(limit);
  },
});

/**
 * Log a maintenance service.
 * Validates item exists, odometer is valid, date is not in the future.
 * Updates the maintenance item's last service tracking and keeps the bike
 * odometer in sync so the reminder engine never sees stale readings.
 */
export const logMaintenance = mutation({
  args: {
    itemId: v.id("maintenanceItems"),
    odometer: v.number(),
    date: v.number(),
    cost: v.optional(v.number()),
    notes: v.optional(v.string()),
    photos: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.id("maintenanceLogs"),
  handler: async (ctx, args) => {
    // Validate item exists
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error(`Maintenance item not found: ${args.itemId}`);
    }

    // Validate odometer is not decreasing
    if (item.lastServiceOdometer !== undefined && args.odometer < item.lastServiceOdometer) {
      throw new Error(
        `Odometer cannot be less than last service odometer (${item.lastServiceOdometer} km)`
      );
    }

    // Validate date is not in the future
    const now = Date.now();
    if (args.date > now) {
      throw new Error("Service date cannot be in the future");
    }

    // Calculate next due values
    const nextDueOdometer = item.intervalKm ? args.odometer + item.intervalKm : undefined;
    const nextDueDate = item.intervalMonths ? args.date + item.intervalMonths * 30 * 24 * 60 * 60 * 1000 : undefined;

    // Create the log
    const logId = await ctx.db.insert("maintenanceLogs", {
      itemId: args.itemId,
      itemName: item.name,
      odometer: args.odometer,
      date: args.date,
      cost: args.cost,
      notes: args.notes,
      nextDueOdometer,
      nextDueDate,
      photos: args.photos,
    });

    // Update the item's last service tracking
    await ctx.db.patch(args.itemId, {
      lastServiceOdometer: args.odometer,
      lastServiceDate: args.date,
    });

    // Keep the bike odometer current — the reminder engine reads it
    const bike = (await ctx.db.query("bike").take(1))[0];
    if (bike && args.odometer > bike.currentOdometer) {
      await ctx.db.patch(bike._id, { currentOdometer: args.odometer });
    }

    return logId;
  },
});

/**
 * Aggregate maintenance cost stats for analytics.
 */
export const getMaintenanceStats = query({
  args: {},
  returns: v.object({
    totalCost: v.number(),
    logCount: v.number(),
  }),
  handler: async (ctx) => {
    const logs = await ctx.db.query("maintenanceLogs").collect();
    return {
      totalCost: logs.reduce((sum, log) => sum + (log.cost ?? 0), 0),
      logCount: logs.length,
    };
  },
});

/**
 * Update a maintenance log (only notes, cost, photos — not odometer or date).
 */
export const updateMaintenanceLog = mutation({
  args: {
    logId: v.id("maintenanceLogs"),
    cost: v.optional(v.number()),
    notes: v.optional(v.string()),
    photos: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log) {
      throw new Error(`Maintenance log not found: ${args.logId}`);
    }

    const updates: Partial<typeof log> = {};
    if (args.cost !== undefined) updates.cost = args.cost;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.photos !== undefined) updates.photos = args.photos;

    await ctx.db.patch(args.logId, updates);
  },
});

/**
 * Delete a maintenance log and clean up associated files.
 * Updates the item's last service to the previous log if any.
 */
export const deleteMaintenanceLog = mutation({
  args: {
    logId: v.id("maintenanceLogs"),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log) {
      throw new Error(`Maintenance log not found: ${args.logId}`);
    }

    // Delete file records and stored blobs for this log
    const fileRecords = await ctx.db
      .query("files")
      .withIndex("by_record", (q) =>
        q.eq("recordType", "maintenanceLog").eq("recordId", args.logId)
      )
      .collect();
    for (const file of fileRecords) {
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }

    // Find previous log for this item to update lastService tracking
    const previousLog = await ctx.db
      .query("maintenanceLogs")
      .withIndex("by_item", (q) => q.eq("itemId", log.itemId))
      .order("desc")
      .filter((q) => q.lt(q.field("_creationTime"), log._creationTime))
      .first();

    // Update item's last service to previous log or clear it
    if (previousLog) {
      await ctx.db.patch(log.itemId, {
        lastServiceOdometer: previousLog.odometer,
        lastServiceDate: previousLog.date,
      });
    } else {
      await ctx.db.patch(log.itemId, {
        lastServiceOdometer: undefined,
        lastServiceDate: undefined,
      });
    }

    // Delete the log
    await ctx.db.delete(args.logId);
  },
});
