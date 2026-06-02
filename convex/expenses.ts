import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
      receiptPhoto: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("expenses")
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
    receiptPhoto: v.optional(v.string()),
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
    receiptPhoto: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error(`Expense not found: ${args.expenseId}`);

    const updates: Partial<typeof expense> = {};
    if (args.category !== undefined) updates.category = args.category;
    if (args.amount !== undefined) updates.amount = args.amount;
    if (args.description !== undefined) updates.description = args.description;
    if (args.receiptPhoto !== undefined) updates.receiptPhoto = args.receiptPhoto;

    await ctx.db.patch(args.expenseId, updates);
    return true;
  },
});

/**
 * Delete an expense.
 */
export const deleteExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error(`Expense not found: ${args.expenseId}`);
    await ctx.db.delete(args.expenseId);
    return true;
  },
});
