/**
 * Pure on-time service streak computation for achievements.
 *
 * A service log is "on time" when it happened at or before the deadline that
 * was in effect for it. That deadline is the `nextDueOdometer` / `nextDueDate`
 * snapshot stored on the item's previous log (written by `logMaintenance` at
 * log time, so it is immune to later interval edits). When a previous log has
 * no snapshot, the deadline is derived from that log's odometer/date plus the
 * item's current interval.
 *
 * The first log of an item has no predecessor deadline, so it counts as
 * on-time by definition (it establishes the baseline) but can never be
 * "early".
 */

export interface StreakLogInput {
  itemId: string;
  odometer: number;
  date: number;
  nextDueOdometer?: number | null;
  nextDueDate?: number | null;
}

export interface StreakItemInput {
  id: string;
  intervalKm?: number | null;
  intervalMonths?: number | null;
}

export interface StreakResult {
  /** Longest run of consecutive on-time services across all items. */
  longestStreak: number;
  /** Run of consecutive on-time services ending at the most recent service. */
  currentStreak: number;
  /** Services logged 500+ km before their due odometer. */
  earlyBirdCount: number;
}

/** Unlock threshold for the early_bird achievement, in km. */
export const EARLY_BIRD_MARGIN_KM = 500;

// Matches the flat 30-day month convention used by logMaintenance when it
// stores nextDueDate snapshots, so fallback dues agree with stored ones.
const MS_PER_30D_MONTH = 30 * 24 * 60 * 60 * 1000;

interface JudgedLog {
  date: number;
  odometer: number;
  onTime: boolean;
  earlyBird: boolean;
}

/**
 * Compute streak statistics from all maintenance logs and their items.
 */
export function computeStreakStats(
  logs: StreakLogInput[],
  items: StreakItemInput[],
): StreakResult {
  const itemsById = new Map(items.map((item) => [item.id, item]));

  // Judge each log against its own item's previous log
  const logsByItem = new Map<string, StreakLogInput[]>();
  for (const log of logs) {
    const group = logsByItem.get(log.itemId) ?? [];
    group.push(log);
    logsByItem.set(log.itemId, group);
  }

  const judged: JudgedLog[] = [];
  for (const [itemId, group] of logsByItem) {
    group.sort((a, b) => a.date - b.date || a.odometer - b.odometer);
    const item = itemsById.get(itemId);

    for (let i = 0; i < group.length; i++) {
      if (i === 0) {
        judged.push({
          date: group[i].date,
          odometer: group[i].odometer,
          onTime: true,
          earlyBird: false,
        });
        continue;
      }

      const prev = group[i - 1];
      const log = group[i];

      // Prefer the stored snapshot; fall back to the item's current interval.
      const dueOdometer =
        prev.nextDueOdometer ??
        (item?.intervalKm ? prev.odometer + item.intervalKm : null);
      const dueDate =
        prev.nextDueDate ??
        (item?.intervalMonths
          ? prev.date + item.intervalMonths * MS_PER_30D_MONTH
          : null);

      const late =
        (dueOdometer !== null && log.odometer > dueOdometer) ||
        (dueDate !== null && log.date > dueDate);

      judged.push({
        date: log.date,
        odometer: log.odometer,
        onTime: !late,
        earlyBird:
          !late &&
          dueOdometer !== null &&
          dueOdometer - log.odometer >= EARLY_BIRD_MARGIN_KM,
      });
    }
  }

  // Global chronological merge: a streak survives only if every service
  // (any item) in the run was on time.
  judged.sort((a, b) => a.date - b.date || a.odometer - b.odometer);

  let longestStreak = 0;
  let currentStreak = 0;
  let run = 0;
  for (const entry of judged) {
    if (entry.onTime) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }
  currentStreak = run;

  return {
    longestStreak,
    currentStreak,
    earlyBirdCount: judged.filter((entry) => entry.earlyBird).length,
  };
}
