import {
  haversineMeters,
  MAX_ACCURACY_METERS,
  trackDistanceKm,
  type TrackPoint,
} from "../../../lib/geo";
import type { LocalRideRecord } from "./ride-model";

export type ActivityShareTemplate = "routeOnly" | "statisticsOnly" | "routeAndStatistics";
export type ActivityShareAspect = "story" | "square";
export type RoutePosition = "top" | "center" | "bottom";

export const ACTIVITY_SHARE_SIZE: Record<ActivityShareAspect, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

export interface ActivityShareStats {
  distanceKm: number;
  elapsedMs: number;
  movingMs: number | null;
  stoppedMs: number | null;
  averageSpeedKmh: number | null;
  maxSpeedKmh: number;
}

export interface ActivityShareData {
  stats: ActivityShareStats;
  routeSegments: TrackPoint[][];
  routeAvailable: boolean;
}

const MOVING_SPEED_MPS = 3 / 3.6;
const MAX_OBSERVED_INTERVAL_MS = 15_000;

function isValidSharePoint(point: TrackPoint): boolean {
  return Number.isFinite(point.lat) && point.lat >= -90 && point.lat <= 90
    && Number.isFinite(point.lon) && point.lon >= -180 && point.lon <= 180
    && Number.isFinite(point.ts)
    && (point.accuracy === undefined || (Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= MAX_ACCURACY_METERS));
}

function validSpeed(point: TrackPoint): number | null {
  return typeof point.speed === "number" && Number.isFinite(point.speed) && point.speed >= 0 && point.speed <= 50
    ? point.speed
    : null;
}

function orderedRuns(points: TrackPoint[]): TrackPoint[][] {
  const runs = new Map<number, TrackPoint[]>();
  for (const point of points.filter(isValidSharePoint)) {
    const runId = point.runId ?? 1;
    const run = runs.get(runId) ?? [];
    run.push(point);
    runs.set(runId, run);
  }

  return [...runs.values()]
    .map((run) => run.sort((left, right) => left.ts - right.ts))
    .sort((left, right) => (left[0]?.ts ?? 0) - (right[0]?.ts ?? 0));
}

function interpolatePoint(a: TrackPoint, b: TrackPoint, ratio: number): TrackPoint {
  return {
    lat: a.lat + (b.lat - a.lat) * ratio,
    lon: a.lon + (b.lon - a.lon) * ratio,
    ts: a.ts + (b.ts - a.ts) * ratio,
    runId: a.runId ?? 1,
    ...(a.accuracy !== undefined && b.accuracy !== undefined
      ? { accuracy: a.accuracy + (b.accuracy - a.accuracy) * ratio }
      : {}),
    ...(validSpeed(a) !== null && validSpeed(b) !== null
      ? { speed: validSpeed(a)! + (validSpeed(b)! - validSpeed(a)!) * ratio }
      : {}),
  };
}

/** Clips only the exported path by distance along the recorded track. */
export function maskTrackEndpoints(
  runs: TrackPoint[][],
  maskStartMeters: number,
  maskEndMeters: number = maskStartMeters,
): TrackPoint[][] {
  const startMask = Math.max(0, Number.isFinite(maskStartMeters) ? maskStartMeters : 0);
  const endMask = Math.max(0, Number.isFinite(maskEndMeters) ? maskEndMeters : 0);
  const edges: { runIndex: number; start: number; end: number; from: TrackPoint; to: TrackPoint }[] = [];
  let totalMeters = 0;

  runs.forEach((run, runIndex) => {
    for (let index = 1; index < run.length; index += 1) {
      const from = run[index - 1];
      const to = run[index];
      const length = haversineMeters(from, to);
      if (!Number.isFinite(length) || length <= 0) continue;
      edges.push({ runIndex, start: totalMeters, end: totalMeters + length, from, to });
      totalMeters += length;
    }
  });

  const visibleStart = Math.min(startMask, totalMeters);
  const visibleEnd = Math.max(visibleStart, totalMeters - endMask);
  const clippedRuns: TrackPoint[][] = [];
  let currentRunIndex = -1;
  let current: TrackPoint[] = [];

  for (const edge of edges) {
    const overlapStart = Math.max(edge.start, visibleStart);
    const overlapEnd = Math.min(edge.end, visibleEnd);
    if (overlapEnd <= overlapStart) continue;

    const length = edge.end - edge.start;
    const from = overlapStart <= edge.start
      ? edge.from
      : interpolatePoint(edge.from, edge.to, (overlapStart - edge.start) / length);
    const to = overlapEnd >= edge.end
      ? edge.to
      : interpolatePoint(edge.from, edge.to, (overlapEnd - edge.start) / length);

    if (currentRunIndex !== edge.runIndex || current.length === 0) {
      current = [];
      clippedRuns.push(current);
      currentRunIndex = edge.runIndex;
      current.push(from);
    } else if (current[current.length - 1] !== from) {
      current.push(from);
    }
    current.push(to);
  }

  return clippedRuns.filter((run) => run.length >= 2);
}

export function projectTrackSegments(
  runs: TrackPoint[][],
  width: number,
  height: number,
  padding = Math.min(width, height) * 0.1,
  position: RoutePosition = "center",
): [number, number][][] {
  const points = runs.flat();
  if (points.length === 0 || width <= 0 || height <= 0) return [];

  const meanLatitude = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const longitudeScale = Math.max(0.01, Math.cos((meanLatitude * Math.PI) / 180));
  const projected = runs.map((run) => run.map((point) => [point.lon * longitudeScale, point.lat] as const));
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of projected.flat()) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(innerWidth / spanX, innerHeight / spanY);
  const renderedWidth = spanX * scale;
  const renderedHeight = spanY * scale;
  const offsetX = (width - renderedWidth) / 2;
  const alignment = position === "top" ? 0 : position === "bottom" ? 1 : 0.5;
  const offsetY = padding + Math.max(0, innerHeight - renderedHeight) * alignment;

  return projected.map((run) => run.map(([x, y]) => [
    offsetX + (x - minX) * scale,
    offsetY + (maxY - y) * scale,
  ]));
}

export function buildActivityShareData(
  ride: LocalRideRecord,
  maskStartMeters = 0,
  maskEndMeters = maskStartMeters,
): ActivityShareData {
  const rawRuns = orderedRuns(ride.points);
  const routeSegments = maskTrackEndpoints(rawRuns, maskStartMeters, maskEndMeters);
  let movingMs = 0;
  let stoppedMs = 0;
  let hasObservedSpeedInterval = false;

  for (const run of rawRuns) {
    for (let index = 1; index < run.length; index += 1) {
      const previous = run[index - 1];
      const current = run[index];
      const interval = current.ts - previous.ts;
      const previousSpeed = validSpeed(previous);
      const currentSpeed = validSpeed(current);
      if (interval <= 0 || interval > MAX_OBSERVED_INTERVAL_MS || previousSpeed === null || currentSpeed === null) continue;
      hasObservedSpeedInterval = true;
      if ((previousSpeed + currentSpeed) / 2 >= MOVING_SPEED_MPS) movingMs += interval;
      else stoppedMs += interval;
    }
  }

  const elapsedMs = Math.max(0, ride.elapsedMs ?? ride.summary.durationMinutes * 60_000);
  const recordedDistance = ride.summary.trackedDistance;
  const distanceKm = Math.max(0, Number.isFinite(recordedDistance) ? recordedDistance : trackDistanceKm(ride.points));
  const averageSpeedKmh = movingMs > 0 ? distanceKm / (movingMs / 3_600_000) : null;
  const distinctRoutePoints = new Set(routeSegments.flat().map((point) => `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`)).size;

  return {
    stats: {
      distanceKm,
      elapsedMs,
      movingMs: hasObservedSpeedInterval ? movingMs : null,
      stoppedMs: hasObservedSpeedInterval ? stoppedMs : null,
      averageSpeedKmh: Number.isFinite(averageSpeedKmh) ? averageSpeedKmh : null,
      maxSpeedKmh: Math.max(0, ride.summary.maxSpeedKmh || 0),
    },
    routeSegments,
    routeAvailable: distinctRoutePoints >= 2,
  };
}
