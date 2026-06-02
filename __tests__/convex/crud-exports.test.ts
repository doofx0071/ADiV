import { describe, expect, it } from 'vitest';

describe('Ride CRUD exports', () => {
  it('rides.ts functions are importable', async () => {
    const rides = await import('../../convex/rides');
    expect(rides).toBeDefined();
    expect(typeof rides.getRides).toBe('function');
    expect(typeof rides.getRideStats).toBe('function');
    expect(typeof rides.logRide).toBe('function');
    expect(typeof rides.updateRide).toBe('function');
    expect(typeof rides.deleteRide).toBe('function');
  });
});

describe('Fuel CRUD exports', () => {
  it('fuel.ts functions are importable', async () => {
    const fuel = await import('../../convex/fuel');
    expect(fuel).toBeDefined();
    expect(typeof fuel.getFuelLogs).toBe('function');
    expect(typeof fuel.getFuelStats).toBe('function');
    expect(typeof fuel.logFuel).toBe('function');
    expect(typeof fuel.updateFuelLog).toBe('function');
    expect(typeof fuel.deleteFuelLog).toBe('function');
  });
});

describe('Expense CRUD exports', () => {
  it('expenses.ts functions are importable', async () => {
    const expenses = await import('../../convex/expenses');
    expect(expenses).toBeDefined();
    expect(typeof expenses.getExpenses).toBe('function');
    expect(typeof expenses.getExpenseStats).toBe('function');
    expect(typeof expenses.addExpense).toBe('function');
    expect(typeof expenses.updateExpense).toBe('function');
    expect(typeof expenses.deleteExpense).toBe('function');
  });
});

describe('File CRUD exports', () => {
  it('files.ts functions are importable', async () => {
    const files = await import('../../convex/files');
    expect(files).toBeDefined();
    expect(typeof files.getFilesByRecord).toBe('function');
    expect(typeof files.registerFile).toBe('function');
    expect(typeof files.deleteFile).toBe('function');
    expect(typeof files.getFileUrl).toBe('function');
  });
});
