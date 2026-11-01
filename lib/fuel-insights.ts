/**
 * Fuel insights engine — accurate per-refuel efficiency using the
 * "filled-to-full" method (the Fuelly standard).
 *
 * A segment is only a valid efficiency measurement when it runs from one
 * full-tank fill to the next: the liters added in that window then exactly
 * replace the fuel burned, so km/L = odometer delta / liters added in the
 * window. Partial fills in between contribute their liters to the closing
 * segment. Partial fills are excluded from efficiency math but still count
 * toward spend, volume, and price analytics.
 *
 * Pure data in, pure data out — no Convex imports (shared client/server).
 */

export interface FuelLogInput {
  odometer: number;
  liters: number;
  date: number;
  pricePerLiter: number;
  totalPrice: number;
  /** undefined = legacy log, treated as a full fill (best effort) */
  fullTank?: boolean;
  stationName?: string;
}

export interface FuelSegment {
  /** Kilometers per liter for the segment (distance / liters added at the later fill). */
  kmL: number;
  distanceKm: number;
  liters: number;
  /** totalPrice of the later fill — the cost of the fuel burned in this segment. */
  cost: number;
  /** Date (ms) of the later fill that closed the segment. */
  date: number;
}

export interface StationStat {
  station: string;
  visits: number;
  liters: number;
  totalCost: number;
  avgPricePerLiter: number;
}

export interface FuelInsights {
  refuelCount: number;
  totalLiters: number;
  totalCost: number;
  avgPricePerLiter: number;
  /** Full→full segments only; the source of truth for efficiency numbers. */
  validSegments: FuelSegment[];
  /** Distance-weighted km/L across valid segments (0 when none). */
  avgKmPerLiter: number;
  bestSegment: FuelSegment | null;
  worstSegment: FuelSegment | null;
  avgLitersPerRefuel: number;
  /** Mean days between consecutive refuels (date-ordered); 0 when < 2 logs. */
  avgDaysBetweenRefuels: number;
  daysSinceLastRefuel: number;
  /** ₱/L per refuel, chronologically. */
  priceSeries: { date: number; pricePerLiter: number }[];
  latestPricePerLiter: number;
  /** All-time monthly spend, ascending by month key "yyyy-MM". */
  monthlySpend: { key: string; spend: number }[];
  /** Fuel cost of valid segments divided by their distance (0 when none). */
  costPerKm: number;
  /** avgKmPerLiter × tank capacity (0 when no segments or no tank data). */
  tankRangeKm: number;
  /** Named stations only, cheapest average price first. */
  stationStats: StationStat[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isFull = (log: FuelLogInput): boolean => log.fullTank !== false;

const monthKey = (date: number): string => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Compute all fuel insights from raw logs.
 *
 * @param logs raw fuel logs in any order (sorted internally by date)
 * @param tankCapacity the bike's tank size in liters (null/0 → no range estimate)
 * @param now reference time for "days since last refuel" (defaults to Date.now())
 */
export function computeFuelInsights(
  logs: FuelLogInput[],
  tankCapacity: number | null | undefined,
  now: number = Date.now(),
): FuelInsights {
  // Date order is the physical truth; insertion order is not (back-filled logs).
  const sorted = [...logs].sort((a, b) => a.date - b.date || a.odometer - b.odometer);

  const refuelCount = sorted.length;
  const totalLiters = sorted.reduce((sum, log) => sum + log.liters, 0);
  const totalCost = sorted.reduce((sum, log) => sum + log.totalPrice, 0);
  const avgPricePerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

  // Valid efficiency segments: from each full fill to the next full fill.
  // Partial fills in between contribute their liters to the closing segment
  // (the tank only returns to "full" at the closer, so the window's total
  // liters = everything added since the opening full fill).
  const validSegments: FuelSegment[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (!isFull(current)) continue;
    let opening = i - 1;
    while (opening >= 0 && !isFull(sorted[opening])) opening--;
    if (opening < 0) continue;
    const window = sorted.slice(opening + 1, i + 1);
    const distanceKm = current.odometer - sorted[opening].odometer;
    const liters = window.reduce((sum, log) => sum + log.liters, 0);
    if (distanceKm <= 0 || liters <= 0) continue;
    validSegments.push({
      kmL: distanceKm / liters,
      distanceKm,
      liters,
      cost: window.reduce((sum, log) => sum + log.totalPrice, 0),
      date: current.date,
    });
  }

  const segmentDistance = validSegments.reduce((sum, s) => sum + s.distanceKm, 0);
  const segmentLiters = validSegments.reduce((sum, s) => sum + s.liters, 0);
  const segmentCost = validSegments.reduce((sum, s) => sum + s.cost, 0);
  const avgKmPerLiter = segmentLiters > 0 ? segmentDistance / segmentLiters : 0;
  const costPerKm = segmentDistance > 0 ? segmentCost / segmentDistance : 0;

  const bestSegment =
    validSegments.length > 0
      ? validSegments.reduce((best, s) => (s.kmL > best.kmL ? s : best))
      : null;
  const worstSegment =
    validSegments.length > 0
      ? validSegments.reduce((worst, s) => (s.kmL < worst.kmL ? s : worst))
      : null;

  // Refuel cadence over ALL logs (partial fills are still refuel events)
  let avgDaysBetweenRefuels = 0;
  if (sorted.length >= 2) {
    const gaps = sorted.slice(1).map((log, index) => log.date - sorted[index].date);
    avgDaysBetweenRefuels =
      gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length / MS_PER_DAY;
  }
  const lastDate = sorted.length > 0 ? sorted[sorted.length - 1].date : 0;
  const daysSinceLastRefuel =
    sorted.length > 0 && now >= lastDate ? (now - lastDate) / MS_PER_DAY : 0;

  const priceSeries = sorted.map((log) => ({
    date: log.date,
    pricePerLiter: log.pricePerLiter,
  }));
  const latestPricePerLiter =
    sorted.length > 0 ? sorted[sorted.length - 1].pricePerLiter : 0;

  // Monthly spend across all logs
  const monthly = new Map<string, number>();
  for (const log of sorted) {
    const key = monthKey(log.date);
    monthly.set(key, (monthly.get(key) ?? 0) + log.totalPrice);
  }
  const monthlySpend = [...monthly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, spend]) => ({ key, spend }));

  // Per-station aggregates (unnamed stations are noise and skipped)
  const stations = new Map<string, { visits: number; liters: number; totalCost: number }>();
  for (const log of sorted) {
    if (!log.stationName) continue;
    const station = stations.get(log.stationName) ?? { visits: 0, liters: 0, totalCost: 0 };
    station.visits += 1;
    station.liters += log.liters;
    station.totalCost += log.totalPrice;
    stations.set(log.stationName, station);
  }
  const stationStats: StationStat[] = [...stations.entries()]
    .map(([station, s]) => ({
      station,
      visits: s.visits,
      liters: s.liters,
      totalCost: s.totalCost,
      avgPricePerLiter: s.liters > 0 ? s.totalCost / s.liters : 0,
    }))
    .sort((a, b) => a.avgPricePerLiter - b.avgPricePerLiter);

  const tankRangeKm =
    tankCapacity && tankCapacity > 0 ? avgKmPerLiter * tankCapacity : 0;

  return {
    refuelCount,
    totalLiters,
    totalCost,
    avgPricePerLiter,
    validSegments,
    avgKmPerLiter,
    bestSegment,
    worstSegment,
    avgLitersPerRefuel: refuelCount > 0 ? totalLiters / refuelCount : 0,
    avgDaysBetweenRefuels,
    daysSinceLastRefuel,
    priceSeries,
    latestPricePerLiter,
    monthlySpend,
    costPerKm,
    tankRangeKm,
    stationStats,
  };
}
