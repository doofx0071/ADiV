import { describe, expect, it } from 'vitest';

describe('Maintenance CRUD exports', () => {
  it('maintenance.ts functions are importable', async () => {
    // We can't fully test Convex mutations without a running backend,
    // but we can verify the module exports exist and have correct shape.
    const maintenance = await import('../../convex/maintenance');
    expect(maintenance).toBeDefined();
    expect(typeof maintenance.getMaintenanceItems).toBe('function');
    expect(typeof maintenance.getMaintenanceLogs).toBe('function');
    expect(typeof maintenance.getAllMaintenanceLogs).toBe('function');
    expect(typeof maintenance.logMaintenance).toBe('function');
    expect(typeof maintenance.updateMaintenanceLog).toBe('function');
    expect(typeof maintenance.deleteMaintenanceLog).toBe('function');
  });
});
