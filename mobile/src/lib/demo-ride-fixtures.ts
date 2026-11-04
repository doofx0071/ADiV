import { trackDistanceKm, trackMaxSpeedKmh, type TrackPoint } from "../../../lib/geo";
import type { LocalRideRecord, RideMode, RideSummaryPayload } from "./ride-model";

export const DEMO_RIDE_IDS = {
  recordOnly: "demo-record-only-v1",
  navigateAndRecord: "demo-navigate-and-record-v1",
} as const;

export interface DemoRideFixture extends LocalRideRecord {
  demoMode: RideMode;
}

const ROUTES: { mode: RideMode; coordinates: [number, number][]; speedMps: number[] }[] = [
  {
    mode: "recordOnly",
    coordinates: [
      [125.6128, 7.0731], [125.6140, 7.0719], [125.6157, 7.0708], [125.6176, 7.0704],
      [125.6191, 7.0714], [125.6201, 7.0730], [125.6207, 7.0748], [125.6195, 7.0762],
      [125.6178, 7.0770], [125.6157, 7.0768], [125.6137, 7.0760], [125.6123, 7.0747],
      [125.6128, 7.0731],
    ],
    speedMps: [0, 3.2, 6.8, 9.4, 11.1, 12.0, 10.5, 8.8, 12.5, 14.2, 11.4, 7.3, 3.1],
  },
  {
    mode: "navigateAndRecord",
    coordinates: [
      [125.5984, 7.0820], [125.6000, 7.0828], [125.6022, 7.0831], [125.6041, 7.0824],
      [125.6056, 7.0809], [125.6073, 7.0795], [125.6094, 7.0786], [125.6118, 7.0784],
      [125.6141, 7.0790], [125.6160, 7.0802], [125.6171, 7.0820], [125.6163, 7.0838],
      [125.6142, 7.0846], [125.6119, 7.0841], [125.6099, 7.0830], [125.6077, 7.0825],
    ],
    speedMps: [0, 4.1, 8.2, 10.3, 12.4, 13.2, 11.5, 9.6, 14.1, 15.0, 12.6, 10.2, 8.4, 11.8, 9.3, 4.0],
  },
];

function makePoints(coordinates: [number, number][], speeds: number[], startedAt: number, elapsedMs: number): TrackPoint[] {
  const intervalMs = elapsedMs / Math.max(1, coordinates.length - 1);
  return coordinates.map(([lon, lat], index) => ({
    lon,
    lat,
    ts: Math.round(startedAt + intervalMs * index),
    accuracy: 5 + (index % 3),
    speed: speeds[index] ?? 0,
    runId: 1,
  }));
}

export function createDemoRideFixtures(now = Date.now()): DemoRideFixture[] {
  return ROUTES.map(({ mode, coordinates, speedMps }, index) => {
    const id = mode === "recordOnly" ? DEMO_RIDE_IDS.recordOnly : DEMO_RIDE_IDS.navigateAndRecord;
    const elapsedMs = mode === "recordOnly" ? 8 * 60_000 : 12 * 60_000;
    const startedAt = now - (index + 1) * 24 * 60 * 60_000;
    const endedAt = startedAt + elapsedMs;
    const points = makePoints(coordinates, speedMps, startedAt, elapsedMs);
    const startOdometer = mode === "recordOnly" ? 8_250 : 8_290;
    const summary: RideSummaryPayload = {
      clientRideId: id,
      startOdometer,
      endOdometer: startOdometer + trackDistanceKm(points),
      date: startedAt,
      durationMinutes: Math.round(elapsedMs / 60_000),
      startAt: startedAt,
      endAt: endedAt,
      source: "gps",
      trackedDistance: trackDistanceKm(points),
      maxSpeedKmh: trackMaxSpeedKmh(points),
      notes: mode === "recordOnly"
        ? "SAMPLE ONLY · Record Only preview · simulated Davao route"
        : "SAMPLE ONLY · Navigate + Record preview · simulated Davao route",
    };

    return {
      id,
      demoMode: mode,
      summary,
      points,
      elapsedMs,
      syncState: "local_only",
      serverRideId: null,
    };
  });
}

export function demoModeForRideId(rideId: string): RideMode | null {
  if (rideId === DEMO_RIDE_IDS.recordOnly) return "recordOnly";
  if (rideId === DEMO_RIDE_IDS.navigateAndRecord) return "navigateAndRecord";
  return null;
}
