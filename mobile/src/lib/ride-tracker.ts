/**
 * GPS ride recorder service.
 *
 * Uses expo-location's background updates through a TaskManager task so the
 * track survives screen-off and app kills (points are persisted to
 * AsyncStorage after every batch). The task runs in the same JS runtime, so
 * a module-level buffer is shared with the recorder screen, which subscribes
 * for live updates.
 *
 * Web: background tasks don't exist — the recorder screen shows a notice and
 * every native call here is guarded.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { shouldAcceptPoint, type TrackPoint } from "./shared";

export const LOCATION_TASK_NAME = "adiv-ride-recorder";
const STORAGE_KEY = "adiv-active-ride";
export const MAX_ACCURACY_METERS = 50;

export interface ActiveRideState {
  points: TrackPoint[];
  startedAt: number | null;
  runId: number;
}

const buffer: TrackPoint[] = [];
let startedAt: number | null = null;
let runId = 1;
let loaded = false;
const listeners = new Set<(point: TrackPoint) => void>();

export function subscribeToTrack(listener: (point: TrackPoint) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTrackPoints(): TrackPoint[] {
  return [...buffer];
}

function persist(): void {
  const state: ActiveRideState = { points: buffer, startedAt, runId };
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

/**
 * Restore a possibly-interrupted recording (process kill, app force-close).
 * Returns the restored state, or null when nothing was in flight.
 */
export async function loadActiveRide(): Promise<ActiveRideState | null> {
  if (loaded) return buffer.length > 0 ? { points: [...buffer], startedAt, runId } : null;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as ActiveRideState;
    buffer.push(...(state.points ?? []));
    startedAt = state.startedAt ?? null;
    runId = state.runId ?? 1;
    return buffer.length > 0 ? { points: [...buffer], startedAt, runId } : null;
  } catch {
    return null;
  }
}

export async function clearActiveRide(): Promise<void> {
  buffer.length = 0;
  startedAt = null;
  runId = 1;
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

export function beginRun(): void {
  startedAt = Date.now();
  // A fresh run after pause/resume gets its own runId so the polyline never
  // connects across the gap.
  if (buffer.length > 0) runId += 1;
  persist();
}

function ingest(location: Location.LocationObject): void {
  const previous = buffer.length > 0 ? buffer[buffer.length - 1] : null;
  const candidate: TrackPoint = {
    lat: location.coords.latitude,
    lon: location.coords.longitude,
    accuracy: location.coords.accuracy ?? undefined,
    speed: location.coords.speed ?? undefined,
    ts: location.timestamp,
    runId,
  };
  if (!shouldAcceptPoint(previous, candidate, MAX_ACCURACY_METERS)) return;
  buffer.push(candidate);
  listeners.forEach((listener) => listener(candidate));
  persist();
}

if (Platform.OS !== "web") {
  TaskManager.defineTask(LOCATION_TASK_NAME, async (body) => {
    const { data, error } = body as unknown as {
      data?: { locations?: Location.LocationObject[] };
      error?: { message?: string };
    };
    if (error) return;
    for (const location of data?.locations ?? []) ingest(location);
  });
}

export async function startRecording(): Promise<void> {
  if (Platform.OS === "web") throw new Error("Ride recording requires the Android app.");

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    throw new Error("Location permission is needed to record your ride.");
  }
  // Background permission is what keeps tracking alive with the screen off.
  // It can be denied — recording still works while the app is open.
  try {
    await Location.requestBackgroundPermissionsAsync();
  } catch {
    // Not available on all platforms/versions.
  }

  beginRun();
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Recording your ride",
      notificationBody: "ADiV is tracking this ride in the background.",
      notificationColor: "#e62025",
      killServiceOnDestroy: false,
    },
  });
}

export async function pauseRecording(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    // Task may not be running — pausing twice is harmless.
  }
  persist();
}

export async function resumeRecording(): Promise<void> {
  await startRecording();
}

export async function discardRecording(): Promise<void> {
  await pauseRecording();
  await clearActiveRide();
}
