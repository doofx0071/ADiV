import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Generate a short-lived upload URL for direct-to-storage uploads.
 * Flow: generateUploadUrl → POST the file → registerFile with the
 * returned storageId.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

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
      storageId: v.id("_storage"),
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
    storageId: v.id("_storage"),
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
 * Delete a file record and its stored blob.
 */
export const deleteFile = mutation({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error(`File not found: ${args.fileId}`);

    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(args.fileId);
  },
});

/**
 * Generate a URL for a stored file.
 */
export const getFileUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Resolve a batch of storage ids to display URLs in one query.
 * Returns null urls for blobs that no longer exist.
 */
export const getFileUrls = query({
  args: {
    storageIds: v.array(v.id("_storage")),
  },
  returns: v.array(
    v.object({
      storageId: v.id("_storage"),
      url: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    return Promise.all(
      args.storageIds.map(async (storageId) => ({
        storageId,
        url: await ctx.storage.getUrl(storageId),
      }))
    );
  },
});
