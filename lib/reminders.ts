import { differenceInDays, addMonths, isAfter, startOfDay } from 'date-fns';

export interface ReminderStatus {
  status: 'upcoming' | 'due' | 'overdue';
  dueInKm: number | null;
  dueInDays: number | null;
  progressPercent: number;
}

export type MaintenanceReadinessStatus =
  | 'overdue'
  | 'due'
  | 'upcoming'
  | 'clear'
  | 'needs-history';

export type MissingServiceBaseline = 'service-date' | 'service-odometer';

export interface MaintenanceBaselineItem {
  intervalKm?: number | null;
  intervalMonths?: number | null;
  lastServiceDate?: number | null;
  lastServiceOdometer?: number | null;
}

export interface MaintenanceEvaluation<T extends MaintenanceBaselineItem> {
  item: T;
  status: MaintenanceReadinessStatus;
  knownStatus: 'overdue' | 'due' | 'upcoming' | 'clear' | null;
  historyComplete: boolean;
  missingBaseline: MissingServiceBaseline[];
  dueAtOdometer: number | null;
  dueAtDate: Date | null;
  dueInKm: number | null;
  dueInDays: number | null;
  progressKm: number | null;
  progressTime: number | null;
  urgencyScore: number;
}

export interface MaintenanceEvaluationSummary {
  total: number;
  historyComplete: number;
  needsHistory: number;
  overdue: number;
  due: number;
  upcoming: number;
  clear: number;
}

const READINESS_PRIORITY: Record<MaintenanceReadinessStatus, number> = {
  overdue: 0,
  due: 1,
  upcoming: 2,
  'needs-history': 3,
  clear: 4,
};

function statusFromRemaining(
  remaining: number,
  dueThreshold: number,
  upcomingThreshold: number
): 'overdue' | 'due' | 'upcoming' | 'clear' {
  if (remaining < 0) return 'overdue';
  if (remaining <= dueThreshold) return 'due';
  if (remaining <= upcomingThreshold) return 'upcoming';
  return 'clear';
}

function mostUrgentStatus(
  statuses: Array<'overdue' | 'due' | 'upcoming' | 'clear'>
): 'overdue' | 'due' | 'upcoming' | 'clear' | null {
  if (statuses.length === 0) return null;
  if (statuses.includes('overdue')) return 'overdue';
  if (statuses.includes('due')) return 'due';
  if (statuses.includes('upcoming')) return 'upcoming';
  return 'clear';
}

/**
 * Evaluate maintenance without inventing missing service baselines.
 * Distance and time are assessed independently; only known dimensions are
 * calculated, and incomplete history can never be labeled clear.
 */
export function evaluateMaintenanceItem<T extends MaintenanceBaselineItem>(
  item: T,
  currentOdometer: number,
  currentDate: Date
): MaintenanceEvaluation<T> {
  const missingBaseline: MissingServiceBaseline[] = [];
  const dimensionStatuses: Array<'overdue' | 'due' | 'upcoming' | 'clear'> = [];
  const intervalKm = item.intervalKm ?? null;
  const intervalMonths = item.intervalMonths ?? null;
  let dueAtOdometer: number | null = null;
  let dueAtDate: Date | null = null;
  let dueInKm: number | null = null;
  let dueInDays: number | null = null;
  let progressKm: number | null = null;
  let progressTime: number | null = null;

  if (intervalMonths !== null && intervalMonths > 0) {
    if (item.lastServiceDate === undefined || item.lastServiceDate === null) {
      missingBaseline.push('service-date');
    } else if (item.lastServiceDate > currentDate.getTime()) {
      missingBaseline.push('service-date');
    } else {
      const lastServiceDate = new Date(item.lastServiceDate);
      dueAtDate = getDueDate(lastServiceDate, intervalMonths);
      dueInDays = differenceInDays(dueAtDate, currentDate);
      dimensionStatuses.push(statusFromRemaining(dueInDays, 7, 30));
      const intervalDuration = dueAtDate.getTime() - lastServiceDate.getTime();
      progressTime = intervalDuration > 0
        ? Math.max(0, (currentDate.getTime() - lastServiceDate.getTime()) / intervalDuration)
        : null;
    }
  }

  if (intervalKm !== null && intervalKm > 0) {
    if (item.lastServiceOdometer === undefined || item.lastServiceOdometer === null) {
      missingBaseline.push('service-odometer');
    } else {
      dueAtOdometer = getDueOdometer(item.lastServiceOdometer, intervalKm);
      dueInKm = dueAtOdometer - currentOdometer;
      dimensionStatuses.push(statusFromRemaining(dueInKm, 500, 1000));
      progressKm = Math.max(0, (currentOdometer - item.lastServiceOdometer) / intervalKm);
    }
  }

  const knownStatus = mostUrgentStatus(dimensionStatuses);
  const historyComplete = missingBaseline.length === 0;
  const status: MaintenanceReadinessStatus = !historyComplete &&
      (knownStatus === null || knownStatus === 'clear')
    ? 'needs-history'
    : knownStatus ?? 'clear';

  return {
    item,
    status,
    knownStatus,
    historyComplete,
    missingBaseline,
    dueAtOdometer,
    dueAtDate,
    dueInKm,
    dueInDays,
    progressKm,
    progressTime,
    urgencyScore: Math.max(progressKm ?? -1, progressTime ?? -1),
  };
}

export function evaluateMaintenanceItems<T extends MaintenanceBaselineItem>(
  items: T[],
  currentOdometer: number,
  currentDate: Date
): MaintenanceEvaluation<T>[] {
  return items
    .map((item) => evaluateMaintenanceItem(item, currentOdometer, currentDate))
    .sort((a, b) => {
      const priorityDifference = READINESS_PRIORITY[a.status] - READINESS_PRIORITY[b.status];
      if (priorityDifference !== 0) return priorityDifference;
      return b.urgencyScore - a.urgencyScore;
    });
}

export function summarizeMaintenanceEvaluations<T extends MaintenanceBaselineItem>(
  evaluations: MaintenanceEvaluation<T>[]
): MaintenanceEvaluationSummary {
  return {
    total: evaluations.length,
    historyComplete: evaluations.filter((evaluation) => evaluation.historyComplete).length,
    needsHistory: evaluations.filter((evaluation) => !evaluation.historyComplete).length,
    overdue: evaluations.filter((evaluation) => evaluation.knownStatus === 'overdue').length,
    due: evaluations.filter((evaluation) => evaluation.knownStatus === 'due').length,
    upcoming: evaluations.filter((evaluation) => evaluation.knownStatus === 'upcoming').length,
    clear: evaluations.filter((evaluation) => evaluation.status === 'clear').length,
  };
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
  if (intervalKm <= 0) throw new Error('intervalKm must be positive');
  // Clamp instead of throwing: a stale bike odometer (loggers sync it up
  // after the fact) must degrade to 0% progress, never crash the caller.
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

/**
 * Human-readable summary of every available reminder dimension.
 * Distance and time are always shown separately; their raw values are never
 * compared because kilometers and days are different units.
 */
export function formatDueText(status: Pick<ReminderStatus, 'dueInKm' | 'dueInDays'>): string {
  const dimensions: string[] = [];
  if (status.dueInKm !== null) {
    dimensions.push(status.dueInKm < 0
      ? `Overdue by ${Math.abs(status.dueInKm).toLocaleString()} km`
      : `Due in ${status.dueInKm.toLocaleString()} km`);
  }
  if (status.dueInDays !== null) {
    const days = Math.abs(status.dueInDays);
    const unit = days === 1 ? 'day' : 'days';
    dimensions.push(status.dueInDays < 0
      ? `Overdue by ${days} ${unit}`
      : `Due in ${days} ${unit}`);
  }
  return dimensions.length > 0 ? dimensions.join(' · ') : 'No interval set';
}
