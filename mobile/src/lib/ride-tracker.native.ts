import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Location as BackgroundLocation, LocationProfile, LocationUpdatesHandle, type Position } from "expo-location/next";
import { Platform } from "react-native";
import { stopMapboxGuidance } from "./mapbox-bridge";
import { shouldAcceptPoint, type TrackPoint } from "../../../lib/geo";
import { trackDistanceKm, trackMaxSpeedKmh } from "./shared";
import {
  clearRideNotification,
  requestRideNotificationPermission,
  updateRideNotification,
  type RideNotificationAction,
} from "./ride-notification";
import {
  appendRidePoints,
  changeActiveRideStatus,
  getActiveRideMode as getStoredActiveRideMode,
  setActiveRideMode,
  discardActiveRide,
  loadActiveRide as loadStoredActiveRide,
  recoverInterruptedActiveRide,
  startOrResumeRide,
} from "./local-ride-store";
import type { ActiveRideState, RideMode } from "./ride-model";

export const LOCATION_TASK_NAME = "adiv-ride-recorder";
export const MAX_ACCURACY_METERS = 50;
const locationUpdates = new LocationUpdatesHandle(LOCATION_TASK_NAME)
  .withProfile(LocationProfile.AUTOMOTIVE_NAVIGATION);
const BACKGROUND_SESSION_NOTIFICATION = {
  notificationTitle: "ADiV · Recording ride",
  notificationBody: "Ride tracking is active. Open ADiV to pause or end.",
  notificationColor: 0xe62025,
  stopOnTaskRemoved: false,
};

type RideLocationFix = {
  lat: number;
  lon: number;
  accuracy: number | null | undefined;
  speed: number | null | undefined;
  ts: number;
};
type LegacyLocationBatch = { locations?: Location.LocationObject[] };
type RideTaskData = Position | LegacyLocationBatch | Location.LocationObject[];

let activeRide: ActiveRideState | null = null;
let buffer: TrackPoint[] = [];
let loaded = false;
let loading: Promise<ActiveRideState | null> | null = null;
let reconciling: Promise<ActiveRideState | null> | null = null;
const listeners = new Set<(point: TrackPoint) => void>();

function notificationElapsedMs(ride: ActiveRideState): number {
  return ride.elapsedMs + (ride.status === "recording" && ride.runStartedAt ? Math.max(0, Date.now() - ride.runStartedAt) : 0);
}

async function refreshRideNotification(ride: ActiveRideState | null = activeRide): Promise<void> {
  if (!ride || (ride.status !== "recording" && ride.status !== "paused")) return;
  await updateRideNotification({
    phase: ride.status,
    elapsedMs: notificationElapsedMs(ride),
    distanceKm: trackDistanceKm(ride.points),
    averageSpeedKmh: notificationElapsedMs(ride) > 0
      ? trackDistanceKm(ride.points) / (notificationElapsedMs(ride) / 3_600_000)
      : 0,
    maxSpeedKmh: trackMaxSpeedKmh(ride.points),
  });
}

export function subscribeToTrack(listener: (point: TrackPoint) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTrackPoints(): TrackPoint[] {
  return [...buffer];
}

export async function loadActiveRide(): Promise<ActiveRideState | null> {
  if (loaded) return activeRide ? { ...activeRide, points: [...buffer] } : null;
  if (loading) return loading;
  loading = (async () => {
    activeRide = await loadStoredActiveRide();
    buffer = activeRide?.points ?? [];
    loaded = true;
    return activeRide ? { ...activeRide, points: [...buffer] } : null;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/** Resume the same ride when Android stopped its location service between app launches. */
export function reconcileActiveRecording(): Promise<ActiveRideState | null> {
  if (Platform.OS === "web") return Promise.resolve(null);
  if (reconciling) return reconciling;
  reconciling = (async () => {
    let ride = await loadStoredActiveRide();
    activeRide = ride;
    buffer = ride ? [...ride.points] : [];
    loaded = true;
    if (!ride || ride.status !== "recording") {
      await stopLocationTask();
      return ride;
    }
    if (await locationTaskIsRunning()) {
      await ensureLocationTaskStarted();
      return { ...ride, points: [...buffer] };
    }

    // The native service is gone. Close at the last persisted GPS sample so
    // time without location updates is not counted as recorded ride time.
    ride = await recoverInterruptedActiveRide();
    if (!ride) return null;
    activeRide = ride;
    buffer = [...ride.points];

    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      await refreshRideNotification(ride);
      return ride;
    }

    ride = await startOrResumeRide();
    activeRide = ride;
    buffer = [...ride.points];
    try {
      await ensureLocationTaskStarted();
    } catch {
      activeRide = await changeActiveRideStatus("paused");
      buffer = activeRide ? [...activeRide.points] : [];
      await refreshRideNotification(activeRide);
      return activeRide;
    }
    await refreshRideNotification(ride);
    return { ...ride, points: [...buffer] };
  })().finally(() => {
    reconciling = null;
  });
  return reconciling;
}

export async function getActiveRideMode(): Promise<RideMode | null> {
  return getStoredActiveRideMode();
}

async function stopLocationTask(): Promise<void> {
  if (Platform.OS === "web") return;
  if (Platform.OS === "android") {
    try {
      if (await locationUpdates.hasStarted()) await locationUpdates.stop();
    } catch {
      // A stopped or unavailable task is already in the desired state.
    }
    try {
      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch {
      // Clean up registrations left by an older app version.
    }
    try {
      await BackgroundLocation.stopBackgroundSession();
    } catch {
      // The service may already be stopped.
    }
    return;
  }
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch {
    // A stopped or unavailable task is already in the desired state.
  }
}

async function locationTaskIsRunning(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "android") {
    try {
      if (await locationUpdates.hasStarted()) return true;
    } catch {
      // Continue by checking the legacy Expo Location task.
    }
  }
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}

function locationTaskOptions() {
  return {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Recording your ride",
      notificationBody: "ADiV is tracking this ride in the background.",
      notificationColor: "#e62025",
      killServiceOnDestroy: false,
    },
  };
}

async function ensureLocationTaskStarted(): Promise<void> {
  if (Platform.OS === "web") return;
  if (Platform.OS === "android") {
    // Remove a task registered by the previous Expo Location API before
    // switching to the SDK 58 handle that survives JS process termination.
    try {
      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch {
      // No legacy task needs migration.
    }
    await BackgroundLocation.ensureBackgroundSessionStarted(BACKGROUND_SESSION_NOTIFICATION);
    if (!await locationUpdates.hasStarted()) await locationUpdates.start();
    return;
  }
  if (await locationTaskIsRunning()) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, locationTaskOptions());
}

async function ingestLocations(locations: RideLocationFix[]): Promise<void> {
  await loadActiveRide();
  if (!activeRide || activeRide.status !== "recording") return;

  const accepted: TrackPoint[] = [];
  let previous = buffer.length > 0 ? buffer[buffer.length - 1] : null;
  for (const location of locations) {
    if (activeRide.runStartedAt && location.ts < activeRide.runStartedAt) continue;
    const candidate: TrackPoint = {
      lat: location.lat,
      lon: location.lon,
      accuracy: location.accuracy ?? undefined,
      speed: location.speed ?? undefined,
      ts: location.ts,
      runId: activeRide.runId,
    };
    if (!shouldAcceptPoint(previous, candidate, MAX_ACCURACY_METERS)) continue;
    accepted.push(candidate);
    previous = candidate;
  }
  if (accepted.length === 0) {
    await refreshRideNotification();
    return;
  }

  await appendRidePoints(activeRide.id, accepted);
  buffer = [...buffer, ...accepted];
  activeRide = { ...activeRide, points: [...buffer] };
  await refreshRideNotification();
  for (const point of accepted) listeners.forEach((listener) => listener(point));
}

if (Platform.OS !== "web") {
  TaskManager.defineTask<RideTaskData>(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error || !data) return;
    if (Array.isArray(data)) {
      const legacyLocations = data as Location.LocationObject[];
      await ingestLocations(legacyLocations.map((location) => ({
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        ts: location.timestamp,
      })));
      return;
    }
    if ("coordinates" in data) {
      await ingestLocations([{
        lat: data.coordinates.latitude,
        lon: data.coordinates.longitude,
        accuracy: data.horizontalAccuracy,
        speed: data.speed,
        ts: data.timestamp,
      }]);
      return;
    }
    if ("coords" in data) {
      const legacyLocation = data as Location.LocationObject;
      await ingestLocations([{
        lat: legacyLocation.coords.latitude,
        lon: legacyLocation.coords.longitude,
        accuracy: legacyLocation.coords.accuracy,
        speed: legacyLocation.coords.speed,
        ts: legacyLocation.timestamp,
      }]);
      return;
    }
    await ingestLocations((data as LegacyLocationBatch).locations?.map((location) => ({
      lat: location.coords.latitude,
      lon: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      ts: location.timestamp,
    })) ?? []);
  });
}

export async function startRecording(mode?: RideMode): Promise<ActiveRideState> {
  await requestRideNotificationPermission();
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    throw new Error("Location permission is needed to record your ride.");
  }
  if (Platform.OS === "android") {
    let backgroundGranted = false;
    try {
      backgroundGranted = (await Location.requestBackgroundPermissionsAsync()).status === "granted";
    } catch {
      backgroundGranted = false;
    }
    if (!backgroundGranted) {
      throw new Error("Allow ADiV to use location all the time so the ride can keep recording when the app is in the background.");
    }
  } else {
    try {
      await Location.requestBackgroundPermissionsAsync();
    } catch {
      // Foreground recording remains available when background permission is denied.
    }
  }

  const ride = await startOrResumeRide();
  if (mode) await setActiveRideMode(mode);
  activeRide = ride;
  buffer = [...ride.points];
  loaded = true;
  try {
    await ensureLocationTaskStarted();
  } catch (error) {
    activeRide = await changeActiveRideStatus("paused");
    if (activeRide) buffer = [...activeRide.points];
    throw error;
  }
  await refreshRideNotification(ride);
  return { ...ride, points: [...buffer] };
}

export async function pauseRecording(): Promise<ActiveRideState | null> {
  await loadActiveRide();
  const serviceWasRunning = await locationTaskIsRunning();
  await stopLocationTask();
  if (!serviceWasRunning && activeRide?.status === "recording") {
    activeRide = await recoverInterruptedActiveRide();
    if (activeRide) buffer = [...activeRide.points];
  }
  stopMapboxGuidance();
  activeRide = await changeActiveRideStatus("paused");
  if (activeRide) buffer = [...activeRide.points];
  await refreshRideNotification();
  return activeRide ? { ...activeRide, points: [...buffer] } : null;
}

export async function finishRecording(): Promise<ActiveRideState | null> {
  await loadActiveRide();
  const serviceWasRunning = await locationTaskIsRunning();
  await stopLocationTask();
  if (!serviceWasRunning && activeRide?.status === "recording") {
    activeRide = await recoverInterruptedActiveRide();
    if (activeRide) buffer = [...activeRide.points];
  }
  stopMapboxGuidance();
  activeRide = await changeActiveRideStatus("completed");
  if (activeRide) buffer = [...activeRide.points];
  await clearRideNotification();
  return activeRide ? { ...activeRide, points: [...buffer] } : null;
}

export async function discardRecording(): Promise<void> {
  await stopLocationTask();
  stopMapboxGuidance();
  await discardActiveRide();
  activeRide = null;
  buffer = [];
  loaded = true;
  await clearRideNotification();
}

export async function handleRideNotificationAction(action: RideNotificationAction): Promise<void> {
  await loadActiveRide();
  if (action === "pause" && activeRide?.status === "recording") await pauseRecording();
  else if (action === "resume" && (activeRide?.status === "paused" || activeRide?.interrupted)) await startRecording();
  else if (action === "end" && (activeRide?.status === "recording" || activeRide?.status === "paused")) await finishRecording();
}

/** One-shot current position for online or offline route planning. */
export async function currentPosition(options: { requestPermission?: boolean } = {}): Promise<[number, number] | null> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted" && options.requestPermission) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== "granted") return null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("GPS fix timed out")), 8_000);
      }),
    ]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
    return [position.coords.longitude, position.coords.latitude];
  } catch {
    return null;
  }
}
