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
    return await ctx.db.query("maintenanceItems").order("asc").collect();
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
      odometer: v.number(),
      date: v.number(),
      cost: v.optional(v.number()),
      notes: v.optional(v.string()),
      nextDueOdometer: v.optional(v.number()),
      nextDueDate: v.optional(v.number()),
      photos: v.optional(v.array(v.string())),
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
      odometer: v.number(),
      date: v.number(),
      cost: v.optional(v.number()),
      notes: v.optional(v.string()),
      nextDueOdometer: v.optional(v.number()),
      nextDueDate: v.optional(v.number()),
      photos: v.optional(v.array(v.string())),
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
 * Updates the maintenance item's last service tracking.
 */
export const logMaintenance = mutation({
  args: {
    itemId: v.id("maintenanceItems"),
    odometer: v.number(),
    date: v.number(),
    cost: v.optional(v.number()),
    notes: v.optional(v.string()),
    photos: v.optional(v.array(v.string())),
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

    return logId;
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
    photos: v.optional(v.array(v.string())),
  },
  returns: v.boolean(),
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
    return true;
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
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log) {
      throw new Error(`Maintenance log not found: ${args.logId}`);
    }

    // Delete associated files if any
    if (log.photos && log.photos.length > 0) {
      for (const fileId of log.photos) {
        const file = await ctx.db
          .query("files")
          .withIndex("by_record", (q) =>
            q.eq("recordType", "maintenanceLog").eq("recordId", args.logId)
          )
          .filter((q) => q.eq(q.field("storageId"), fileId))
          .first();
        if (file) {
          await ctx.db.delete(file._id);
        }
      }
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
    return true;
  },
});
