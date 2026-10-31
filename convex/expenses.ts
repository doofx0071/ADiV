import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Query all expenses ordered by date desc.
 */
export const getExpenses = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("expenses"),
      _creationTime: v.number(),
      category: v.string(),
      amount: v.number(),
      date: v.number(),
      description: v.optional(v.string()),
      receiptPhoto: v.optional(v.id("_storage")),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("expenses")
      .withIndex("by_date", (q) => q)
      .order("desc")
      .take(limit);
  },
});

/**
 * Get expense stats by category.
 */
export const getExpenseStats = query({
  args: {},
  returns: v.object({
    totalAmount: v.number(),
    count: v.number(),
    byCategory: v.array(
      v.object({
        category: v.string(),
        amount: v.number(),
        count: v.number(),
      })
    ),
  }),
  handler: async (ctx) => {
    const expenses = await ctx.db.query("expenses").collect();
    const byCategory: Record<string, { amount: number; count: number }> = {};

    for (const e of expenses) {
      if (!byCategory[e.category]) {
        byCategory[e.category] = { amount: 0, count: 0 };
      }
      byCategory[e.category].amount += e.amount;
      byCategory[e.category].count += 1;
    }

    return {
      totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
      count: expenses.length,
      byCategory: Object.entries(byCategory).map(([category, stats]) => ({
        category,
        amount: stats.amount,
        count: stats.count,
      })),
    };
  },
});

/**
 * Add an expense.
 */
export const addExpense = mutation({
  args: {
    category: v.string(),
    amount: v.number(),
    date: v.number(),
    description: v.optional(v.string()),
    receiptPhoto: v.optional(v.id("_storage")),
  },
  returns: v.id("expenses"),
  handler: async (ctx, args) => {
    if (args.amount <= 0) throw new Error("Amount must be positive");
    if (args.date > Date.now()) throw new Error("Expense date cannot be in the future");

    return await ctx.db.insert("expenses", {
      category: args.category,
      amount: args.amount,
      date: args.date,
      description: args.description,
      receiptPhoto: args.receiptPhoto,
    });
  },
});

/**
 * Update an expense.
 */
export const updateExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
    category: v.optional(v.string()),
    amount: v.optional(v.number()),
    description: v.optional(v.string()),
    // Pass null to remove the receipt; a storage id sets/replaces it.
    receiptPhoto: v.optional(v.union(v.id("_storage"), v.null())),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error(`Expense not found: ${args.expenseId}`);

    const updates: Partial<typeof expense> = {};
    if (args.category !== undefined) updates.category = args.category;
    if (args.amount !== undefined) updates.amount = args.amount;
    if (args.description !== undefined) updates.description = args.description;
    if (args.receiptPhoto !== undefined) {
      updates.receiptPhoto = args.receiptPhoto ?? undefined;
    }

    await ctx.db.patch(args.expenseId, updates);
  },
});

/**
 * Attach (or replace) an expense receipt after a direct-to-storage upload.
 * Registers the files row, patches the expense, and cleans up any previous
 * receipt blob so replacements never orphan storage.
 */
export const attachExpenseReceipt = mutation({
  args: {
    expenseId: v.id("expenses"),
    storageId: v.id("_storage"),
    name: v.string(),
    type: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error(`Expense not found: ${args.expenseId}`);
    if (args.size > 5 * 1024 * 1024) {
      throw new Error("File size exceeds 5MB limit");
    }

    const previousReceipt = expense.receiptPhoto;
    await ctx.db.insert("files", {
      storageId: args.storageId,
      name: args.name,
      type: args.type,
      size: args.size,
      recordType: "expense",
      recordId: args.expenseId,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.expenseId, { receiptPhoto: args.storageId });

    // Remove the previous receipt's files row(s) and blob(s)
    const oldFiles = await ctx.db
      .query("files")
      .withIndex("by_record", (q) =>
        q.eq("recordType", "expense").eq("recordId", args.expenseId)
      )
      .collect();
    for (const file of oldFiles) {
      if (file.storageId === args.storageId) continue;
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }
    if (previousReceipt && previousReceipt !== args.storageId) {
      await ctx.storage.delete(previousReceipt);
    }
  },
});

/**
 * Remove an expense's receipt: clears the field and deletes the files row
 * and stored blob.
 */
export const removeExpenseReceipt = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error(`Expense not found: ${args.expenseId}`);

    const fileRecords = await ctx.db
      .query("files")
      .withIndex("by_record", (q) =>
        q.eq("recordType", "expense").eq("recordId", args.expenseId)
      )
      .collect();
    const deleted = new Set<Id<"_storage">>();
    for (const file of fileRecords) {
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
      deleted.add(file.storageId);
    }
    if (expense.receiptPhoto && !deleted.has(expense.receiptPhoto)) {
      await ctx.storage.delete(expense.receiptPhoto);
    }

    await ctx.db.patch(args.expenseId, { receiptPhoto: undefined });
  },
});

/**
 * Delete an expense and clean up its receipt blob and file records.
 */
export const deleteExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error(`Expense not found: ${args.expenseId}`);

    // Delete file records and stored blob for this expense's receipt
    const fileRecords = await ctx.db
      .query("files")
      .withIndex("by_record", (q) =>
        q.eq("recordType", "expense").eq("recordId", args.expenseId)
      )
      .collect();
    const deletedStorageIds = new Set<Id<"_storage">>();
    for (const file of fileRecords) {
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
      deletedStorageIds.add(file.storageId);
    }
    // Also drop the blob if the expense references one without a files row
    if (expense.receiptPhoto && !deletedStorageIds.has(expense.receiptPhoto)) {
      await ctx.storage.delete(expense.receiptPhoto);
    }

    await ctx.db.delete(args.expenseId);
  },
});
