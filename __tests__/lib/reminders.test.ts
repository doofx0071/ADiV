import { describe, expect, it } from 'vitest';
import {
  calculateProgress,
  calculateStatus,
  evaluateMaintenanceItem,
  evaluateMaintenanceItems,
  formatDueText,
  getDueDate,
  getDueOdometer,
  isOverdue,
} from '../../lib/reminders';

describe('getDueOdometer', () => {
  it('calculates due odometer from last service and interval', () => {
    expect(getDueOdometer(0, 6000)).toBe(6000);
    expect(getDueOdometer(5500, 6000)).toBe(11500);
  });

  it('throws for negative interval', () => {
    expect(() => getDueOdometer(0, -1000)).toThrow('intervalKm must be positive');
  });
});

describe('getDueDate', () => {
  it('calculates due date from last service date and interval months', () => {
    const lastService = new Date('2024-01-01');
    const result = getDueDate(lastService, 12);
    expect(result).toEqual(new Date('2025-01-01'));
  });

  it('throws for negative interval', () => {
    expect(() => getDueDate(new Date(), -6)).toThrow('intervalMonths must be positive');
  });
});

describe('calculateProgress', () => {
  it('returns 0-1 progress toward interval', () => {
    expect(calculateProgress(3000, 0, 6000)).toBe(0.5);
    expect(calculateProgress(5500, 0, 6000)).toBeCloseTo(0.917, 2);
    expect(calculateProgress(0, 0, 6000)).toBe(0);
  });

  it('clamps to 0 on odometer rollback instead of throwing', () => {
    expect(calculateProgress(1000, 2000, 6000)).toBe(0);
  });
});

describe('isOverdue', () => {
  it('returns true when past km interval', () => {
    expect(isOverdue(6500, new Date(), 0, new Date('2024-01-01'), 6000, 12)).toBe(true);
  });

  it('returns true when past time interval', () => {
    expect(isOverdue(1000, new Date('2026-01-01'), 0, new Date('2024-01-01'), 6000, 12)).toBe(true);
  });

  it('returns false when within interval', () => {
    expect(isOverdue(5500, new Date('2024-06-01'), 0, new Date('2024-01-01'), 6000, 12)).toBe(false);
  });
});

describe('calculateStatus', () => {
  it('engine oil at 5400km → upcoming (due in 600km)', () => {
    const result = calculateStatus(5400, new Date('2024-06-15'), 0, new Date('2024-01-01'), 6000, 12);
    expect(result.status).toBe('upcoming');
    expect(result.dueInKm).toBe(600);
    expect(result.progressPercent).toBe(90);
  });

  it('coolant 3.5 years old with 36mo interval → overdue', () => {
    const result = calculateStatus(
      1000,
      new Date('2027-07-01'),
      0,
      new Date('2024-01-01'),
      null,
      36
    );
    expect(result.status).toBe('overdue');
    expect(result.dueInDays).toBeLessThan(0);
  });

  it('tire pressure checked 15 days ago with 30-day interval → upcoming', () => {
    const result = calculateStatus(
      500,
      new Date('2024-06-15'),
      0,
      new Date('2024-05-31'),
      null,
      1
    );
    expect(result.status).toBe('upcoming');
  });

  it('odometer rollback → clamps instead of throwing', () => {
    // Bike odometer behind the item's last service: math still computes
    // (due at last + interval), progress clamps to 0, no crash.
    const result = calculateStatus(1000, new Date(), 2000, new Date('2024-01-01'), 6000, 12);
    expect(result.progressPercent).toBe(0);
    expect(result.dueInKm).toBe(7000);
    expect(['upcoming', 'due', 'overdue']).toContain(result.status);
  });

  it('future-dated service → throws error', () => {
    expect(() =>
      calculateStatus(1000, new Date('2024-01-01'), 0, new Date('2025-01-01'), 6000, 12)
    ).toThrow('Last service date cannot be in the future');
  });

  it('negative intervalKm → throws error', () => {
    expect(() => calculateStatus(1000, new Date(), 0, new Date('2023-01-01'), -1000, 12)).toThrow(
      'intervalKm must be positive'
    );
  });

  it('time-only task (null intervalKm)', () => {
    const result = calculateStatus(
      1000,
      new Date('2025-06-01'),
      0,
      new Date('2023-06-01'),
      null,
      24
    );
    expect(result.dueInKm).toBeNull();
    expect(result.dueInDays).not.toBeNull();
  });

  it('km-only task (null intervalMonths)', () => {
    const result = calculateStatus(
      5500,
      new Date('2024-06-01'),
      0,
      new Date('2024-01-01'),
      6000,
      null
    );
    expect(result.dueInKm).toBe(500);
    expect(result.dueInDays).toBeNull();
  });

  it('due within 500km → status due', () => {
    const result = calculateStatus(5700, new Date('2024-06-15'), 0, new Date('2024-01-01'), 6000, 12);
    expect(result.status).toBe('due');
    expect(result.dueInKm).toBe(300);
  });

  it('due within 7 days → status due', () => {
    const result = calculateStatus(
      1000,
      new Date('2025-05-30'),
      0,
      new Date('2024-06-01'),
      null,
      12
    );
    expect(result.status).toBe('due');
    expect(result.dueInDays).toBeGreaterThan(0);
    expect(result.dueInDays).toBeLessThanOrEqual(7);
  });

  it('both time and km overdue → overdue', () => {
    const result = calculateStatus(
      7000,
      new Date('2025-06-01'),
      0,
      new Date('2023-01-01'),
      6000,
      12
    );
    expect(result.status).toBe('overdue');
  });
});

describe('formatDueText', () => {
  it('shows both distance and time when both are available', () => {
    expect(
      formatDueText({ dueInKm: -200, dueInDays: 10 })
    ).toBe('Overdue by 200 km · Due in 10 days');
  });

  it('keeps a known overdue dimension visible beside a future dimension', () => {
    expect(
      formatDueText({ dueInKm: 800, dueInDays: -3 })
    ).toBe('Due in 800 km · Overdue by 3 days');
  });

  it('never compares kilometers directly with days', () => {
    expect(
      formatDueText({ dueInKm: 2000, dueInDays: 10 })
    ).toBe('Due in 2,000 km · Due in 10 days');
    expect(
      formatDueText({ dueInKm: 500, dueInDays: 30 })
    ).toBe('Due in 500 km · Due in 30 days');
  });

  it('handles single-interval tasks', () => {
    expect(
      formatDueText({ dueInKm: null, dueInDays: 5 })
    ).toBe('Due in 5 days');
    expect(
      formatDueText({ dueInKm: 300, dueInDays: null })
    ).toBe('Due in 300 km');
  });

  it('handles no intervals', () => {
    expect(
      formatDueText({ dueInKm: null, dueInDays: null })
    ).toBe('No interval set');
  });
});

describe('evaluateMaintenanceItem', () => {
  const currentDate = new Date('2025-01-01T12:00:00.000Z');

  it('marks a seeded item with no service baseline as needing history', () => {
    const result = evaluateMaintenanceItem(
      { name: 'Engine oil', intervalKm: 6000, intervalMonths: 12 },
      4162,
      currentDate
    );

    expect(result.status).toBe('needs-history');
    expect(result.historyComplete).toBe(false);
    expect(result.missingBaseline).toEqual(['service-date', 'service-odometer']);
    expect(result.dueInKm).toBeNull();
    expect(result.dueInDays).toBeNull();
  });

  it('calculates the known time dimension but keeps partial history incomplete', () => {
    const result = evaluateMaintenanceItem(
      {
        name: 'Engine oil',
        intervalKm: 6000,
        intervalMonths: 12,
        lastServiceDate: new Date('2024-01-26T12:00:00.000Z').getTime(),
      },
      4162,
      currentDate
    );

    expect(result.status).toBe('upcoming');
    expect(result.historyComplete).toBe(false);
    expect(result.missingBaseline).toEqual(['service-odometer']);
    expect(result.dueInKm).toBeNull();
    expect(result.dueInDays).not.toBeNull();
  });

  it('keeps a confirmed overdue dimension visible when another baseline is missing', () => {
    const result = evaluateMaintenanceItem(
      {
        name: 'Engine oil',
        intervalKm: 6000,
        intervalMonths: 12,
        lastServiceOdometer: 0,
      },
      6500,
      currentDate
    );

    expect(result.status).toBe('overdue');
    expect(result.historyComplete).toBe(false);
    expect(result.missingBaseline).toEqual(['service-date']);
    expect(result.dueInKm).toBe(-500);
  });

  it('requires only the baseline for a time-only interval', () => {
    const result = evaluateMaintenanceItem(
      {
        name: 'Coolant',
        intervalKm: null,
        intervalMonths: 36,
        lastServiceDate: new Date('2024-03-01T12:00:00.000Z').getTime(),
      },
      4162,
      currentDate
    );

    expect(result.historyComplete).toBe(true);
    expect(result.dueAtOdometer).toBeNull();
    expect(result.dueInDays).not.toBeNull();
  });

  it('returns clear only when all required baselines are present and outside alert windows', () => {
    const result = evaluateMaintenanceItem(
      {
        name: 'Engine oil',
        intervalKm: 6000,
        intervalMonths: 12,
        lastServiceDate: new Date('2024-03-01T12:00:00.000Z').getTime(),
        lastServiceOdometer: 0,
      },
      1000,
      currentDate
    );

    expect(result.status).toBe('clear');
    expect(result.historyComplete).toBe(true);
    expect(result.dueAtOdometer).toBe(6000);
    expect(result.dueAtDate).toEqual(new Date('2025-03-01T12:00:00.000Z'));
  });

  it('preserves the distance reminder boundaries', () => {
    const item = {
      name: 'Engine oil',
      intervalKm: 6000,
      intervalMonths: null,
      lastServiceOdometer: 0,
    };
    const statusAt = (currentOdometer: number) =>
      evaluateMaintenanceItem(item, currentOdometer, currentDate).status;

    expect(statusAt(6001)).toBe('overdue');
    expect(statusAt(5500)).toBe('due');
    expect(statusAt(5000)).toBe('upcoming');
    expect(statusAt(4999)).toBe('clear');
  });

  it('preserves the time reminder boundaries', () => {
    const item = {
      name: 'Coolant',
      intervalKm: null,
      intervalMonths: 12,
      lastServiceDate: new Date('2024-01-01T12:00:00.000Z').getTime(),
    };
    const statusAt = (date: string) =>
      evaluateMaintenanceItem(item, 4162, new Date(date)).status;

    expect(statusAt('2025-01-02T12:00:00.000Z')).toBe('overdue');
    expect(statusAt('2024-12-25T12:00:00.000Z')).toBe('due');
    expect(statusAt('2024-12-02T12:00:00.000Z')).toBe('upcoming');
    expect(statusAt('2024-12-01T12:00:00.000Z')).toBe('clear');
  });

  it('orders due and overdue items before history-needed and clear items', () => {
    const results = evaluateMaintenanceItems(
      [
        { name: 'Clear', intervalKm: 6000, intervalMonths: 12, lastServiceDate: new Date('2024-06-01T12:00:00.000Z').getTime(), lastServiceOdometer: 2000 },
        { name: 'Unknown', intervalKm: 6000, intervalMonths: 12 },
        { name: 'Overdue', intervalKm: 6000, intervalMonths: 12, lastServiceDate: new Date('2023-12-30T12:00:00.000Z').getTime(), lastServiceOdometer: 0 },
        { name: 'Due', intervalKm: 6000, intervalMonths: 12, lastServiceDate: new Date('2024-01-08T12:00:00.000Z').getTime(), lastServiceOdometer: 2000 },
      ],
      6500,
      currentDate
    );

    expect(results.map((result) => result.item.name)).toEqual([
      'Overdue',
      'Due',
      'Unknown',
      'Clear',
    ]);
  });
});
