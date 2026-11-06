import type { TrackPoint } from "../../../lib/geo";
import type {
  ActiveRideState,
  LocalRideRecord,
  RideMode,
  RideOutboxEntry,
  RideSummaryPayload,
} from "./ride-model";

/** Web fallback: GPS recording is Android-only; this module avoids SQLite's web/WASM setup. */
export async function loadActiveRide(): Promise<ActiveRideState | null> {
  return null;
}

export async function recoverInterruptedActiveRide(): Promise<ActiveRideState | null> {
  return null;
}

export async function continueRecordingAfterTrackingGap(): Promise<ActiveRideState | null> {
  return null;
}

export async function startOrResumeRide(): Promise<ActiveRideState> {
  throw new Error("Ride recording requires the Android app.");
}

export async function appendRidePoints(_rideId: string, _points: TrackPoint[]): Promise<void> {
  throw new Error("Ride recording requires the Android app.");
}

export async function changeActiveRideStatus(
  _status: "paused" | "completed",
): Promise<ActiveRideState | null> {
  return null;
}

export async function discardActiveRide(): Promise<void> {}

export async function setActiveRideMode(_mode: RideMode): Promise<void> {}

export async function getActiveRideMode(): Promise<RideMode | null> { return null; }

export async function clearActiveRideMode(): Promise<void> {}

export async function saveRideSummary(
  _rideId: string,
  _summary: RideSummaryPayload,
): Promise<void> {
  throw new Error("Ride recording requires the Android app.");
}

export async function listSavedLocalRides(_limit = 50): Promise<LocalRideRecord[]> {
  return [];
}

export async function addDemoRidesToLocalHistory(): Promise<never> {
  throw new Error("Sample GPS rides are available in the Android app only.");
}

export async function getSavedLocalRide(_rideId: string): Promise<LocalRideRecord | null> {
  return null;
}

export async function getDueRideOutbox(_now = Date.now(), _limit = 5): Promise<RideOutboxEntry[]> {
  return [];
}

export async function acknowledgeRideUpload(_clientRideId: string, _serverRideId: string): Promise<void> {}

export async function deferRideUpload(
  _clientRideId: string,
  _attemptCount: number,
  _nextAttemptAt: number,
): Promise<void> {}

export async function deleteSavedLocalRide(_rideId: string): Promise<void> {}
