import { differenceInDays, addMonths, isAfter, startOfDay } from 'date-fns';

export interface ReminderStatus {
  status: 'upcoming' | 'due' | 'overdue';
  dueInKm: number | null;
  dueInDays: number | null;
  progressPercent: number;
}

/**
 * Calculate the due odometer reading based on last service and interval.
 */
export function getDueOdometer(lastServiceOdometer: number, intervalKm: number | null): number {
  if (intervalKm === null) return 0;
  if (intervalKm <= 0) throw new Error('intervalKm must be positive');
  return lastServiceOdometer + intervalKm;
}

/**
 * Calculate the due date based on last service date and interval in months.
 */
export function getDueDate(lastServiceDate: Date, intervalMonths: number | null): Date {
  if (intervalMonths === null) return new Date(0);
  if (intervalMonths <= 0) throw new Error('intervalMonths must be positive');
  return addMonths(lastServiceDate, intervalMonths);
}

/**
 * Calculate progress toward the next service (0 to 1).
 */
export function calculateProgress(
  currentOdometer: number,
  lastServiceOdometer: number,
  intervalKm: number | null
): number {
  if (intervalKm === null) return 0;
  if (currentOdometer < lastServiceOdometer) {
    throw new Error('Current odometer cannot be less than last service odometer');
  }
  if (intervalKm <= 0) throw new Error('intervalKm must be positive');
  const progress = (currentOdometer - lastServiceOdometer) / intervalKm;
  return Math.min(Math.max(progress, 0), 1);
}

/**
 * Check if maintenance is overdue based on km and/or time.
 */
export function isOverdue(
  currentOdometer: number,
  currentDate: Date,
  lastServiceOdometer: number,
  lastServiceDate: Date,
  intervalKm: number | null,
  intervalMonths: number | null
): boolean {
  const status = calculateStatus(
    currentOdometer,
    currentDate,
    lastServiceOdometer,
    lastServiceDate,
    intervalKm,
    intervalMonths
  );
  return status.status === 'overdue';
}

/**
 * Calculate the full reminder status for a maintenance item.
 *
 * Thresholds:
 * - upcoming: due within 1,000 km OR 30 days
 * - due: due within 500 km OR 7 days
 * - overdue: past due
 */
export function calculateStatus(
  currentOdometer: number,
  currentDate: Date,
  lastServiceOdometer: number,
  lastServiceDate: Date,
  intervalKm: number | null,
  intervalMonths: number | null
): ReminderStatus {
  // Validate inputs
  if (currentOdometer < lastServiceOdometer) {
    throw new Error('Current odometer cannot be less than last service odometer');
  }
  if (isAfter(startOfDay(lastServiceDate), startOfDay(currentDate))) {
    throw new Error('Last service date cannot be in the future');
  }
  if (intervalKm !== null && intervalKm <= 0) {
    throw new Error('intervalKm must be positive');
  }
  if (intervalMonths !== null && intervalMonths <= 0) {
    throw new Error('intervalMonths must be positive');
  }

  // If both intervals are null, nothing to track
  if (intervalKm === null && intervalMonths === null) {
    return { status: 'upcoming', dueInKm: null, dueInDays: null, progressPercent: 0 };
  }

  // Calculate km-based status
  let kmStatus: 'ok' | 'upcoming' | 'due' | 'overdue' = 'ok';
  let dueInKm: number | null = null;
  if (intervalKm !== null) {
    dueInKm = getDueOdometer(lastServiceOdometer, intervalKm) - currentOdometer;
    if (dueInKm < 0) kmStatus = 'overdue';
    else if (dueInKm <= 500) kmStatus = 'due';
    else if (dueInKm <= 1000) kmStatus = 'upcoming';
  }

  // Calculate time-based status
  let timeStatus: 'ok' | 'upcoming' | 'due' | 'overdue' = 'ok';
  let dueInDays: number | null = null;
  if (intervalMonths !== null) {
    const dueDate = getDueDate(lastServiceDate, intervalMonths);
    dueInDays = differenceInDays(dueDate, currentDate);
    if (dueInDays < 0) timeStatus = 'overdue';
    else if (dueInDays <= 7) timeStatus = 'due';
    else if (dueInDays <= 30) timeStatus = 'upcoming';
  }

  // Combine statuses — worst wins
  const statuses = [kmStatus, timeStatus].filter((s) => s !== 'ok');
  let combinedStatus: 'upcoming' | 'due' | 'overdue' = 'upcoming';
  if (statuses.includes('overdue')) combinedStatus = 'overdue';
  else if (statuses.includes('due')) combinedStatus = 'due';
  else if (statuses.includes('upcoming')) combinedStatus = 'upcoming';
  else combinedStatus = 'upcoming'; // default when both are ok (shouldn't happen with valid intervals)

  // Progress percent
  const progressPercent = intervalKm !== null
    ? calculateProgress(currentOdometer, lastServiceOdometer, intervalKm) * 100
    : 0;

  return {
    status: combinedStatus,
    dueInKm,
    dueInDays,
    progressPercent,
  };
}
