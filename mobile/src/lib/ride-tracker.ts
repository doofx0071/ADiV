import type { TrackPoint } from "../../../lib/geo";
import type { ActiveRideState, LocalRideRecord, RideMode } from "./ride-model";

export type { ActiveRideState, LocalRideRecord } from "./ride-model";

/** The mobile web target keeps its existing Android-only recorder notice. */
export function subscribeToTrack(_listener: (point: TrackPoint) => void): () => void {
  return () => undefined;
}

export function getTrackPoints(): TrackPoint[] {
  return [];
}

export async function loadActiveRide(): Promise<ActiveRideState | null> {
  return null;
}

export async function reconcileActiveRecording(): Promise<ActiveRideState | null> {
  return null;
}

export async function refreshActiveRideNotification(): Promise<void> {}

export async function getActiveRideMode(): Promise<RideMode | null> { return null; }

export async function startRecording(_mode?: RideMode): Promise<ActiveRideState> {
  throw new Error("Ride recording requires the Android app.");
}

export async function pauseRecording(): Promise<ActiveRideState | null> {
  return null;
}

export async function finishRecording(): Promise<ActiveRideState | null> {
  return null;
}

export async function discardRecording(): Promise<void> {}

export async function currentPosition(_options: { requestPermission?: boolean } = {}): Promise<[number, number] | null> {
  return null;
}
