import type { TrackPoint } from "../../../lib/geo";
import { trackDistanceKm, trackMaxSpeedKmh } from "../../../lib/geo";

export type PersistedRideStatus = "recording" | "paused" | "completed" | "saved";
export type RecorderPhase = "idle" | "recording" | "paused" | "recovered" | "summary";
export type RideSyncState = "local_only" | "pending_sync" | "synced";
export const RIDE_MODES = ["recordOnly", "navigateAndRecord"] as const;
export type RideMode = (typeof RIDE_MODES)[number];

export interface ActiveRideState {
  id: string;
  points: TrackPoint[];
  startedAt: number;
  endedAt: number | null;
  runId: number;
  runStartedAt: number | null;
  elapsedMs: number;
  status: Exclude<PersistedRideStatus, "saved">;
  interrupted: boolean;
}

export interface RideSummaryPayload {
  clientRideId: string;
  startOdometer: number;
  endOdometer: number;
  date: number;
  durationMinutes: number;
  startAt: number;
  endAt: number;
  source: "gps";
  trackedDistance: number;
  maxSpeedKmh: number;
  notes?: string;
}

export interface LocalRideRecord {
  id: string;
  summary: RideSummaryPayload;
  points: TrackPoint[];
  /** Present only for built-in local demo rides. */
  demoMode?: RideMode;
  /** Exact local duration; the uploaded summary is rounded to minutes. */
  elapsedMs?: number;
  syncState: RideSyncState;
  serverRideId: string | null;
}

export interface RideOutboxEntry {
  operationId: string;
  clientRideId: string;
  payload: RideSummaryPayload;
  attemptCount: number;
  nextAttemptAt: number | null;
}

export function restoredRecorderPhase(
  status: PersistedRideStatus,
  interrupted: boolean,
): RecorderPhase {
  if (status === "completed") return "summary";
  if (interrupted) return "recovered";
  if (status === "paused") return "paused";
  return "recovered";
}

export function buildRideSummaryPayload(input: {
  clientRideId: string;
  startOdometer: number;
  points: TrackPoint[];
  startedAt: number;
  endedAt: number;
  elapsedMs: number;
  notes?: string;
}): RideSummaryPayload {
  const trackedDistance = trackDistanceKm(input.points);
  const durationMinutes = Math.max(1, Math.round(Math.max(0, input.elapsedMs) / 60_000));
  return {
    clientRideId: input.clientRideId,
    startOdometer: input.startOdometer,
    endOdometer: input.startOdometer + trackedDistance,
    date: input.startedAt,
    durationMinutes,
    startAt: input.startedAt,
    endAt: input.endedAt,
    source: "gps",
    trackedDistance,
    maxSpeedKmh: trackMaxSpeedKmh(input.points),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };
}
