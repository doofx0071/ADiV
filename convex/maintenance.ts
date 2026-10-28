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
      intervalMonths: v.number(),
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
