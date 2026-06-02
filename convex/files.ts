import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Query files for a specific record.
 */
export const getFilesByRecord = query({
  args: {
    recordType: v.string(),
    recordId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("files"),
      _creationTime: v.number(),
      storageId: v.string(),
      name: v.string(),
      type: v.string(),
      size: v.number(),
      recordType: v.string(),
      recordId: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_record", (q) =>
        q.eq("recordType", args.recordType).eq("recordId", args.recordId)
      )
      .order("desc")
      .collect();
  },
});

/**
 * Register a file after upload to Convex storage.
 */
export const registerFile = mutation({
  args: {
    storageId: v.string(),
    name: v.string(),
    type: v.string(),
    size: v.number(),
    recordType: v.string(),
    recordId: v.string(),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    if (args.size > 5 * 1024 * 1024) {
      throw new Error("File size exceeds 5MB limit");
    }

    return await ctx.db.insert("files", {
      storageId: args.storageId,
      name: args.name,
      type: args.type,
      size: args.size,
      recordType: args.recordType,
      recordId: args.recordId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Delete a file record and its stored file.
 */
export const deleteFile = mutation({
  args: {
    fileId: v.id("files"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error(`File not found: ${args.fileId}`);

    await ctx.storage.delete(file.storageId as any);
    await ctx.db.delete(args.fileId);
    return true;
  },
});

/**
 * Generate a URL for a stored file.
 */
export const getFileUrl = query({
  args: {
    storageId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId as any);
  },
});
