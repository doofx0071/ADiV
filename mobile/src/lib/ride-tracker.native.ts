import * as Location from "expo-location";
import {
  defineLocationTask,
  Location as BackgroundLocation,
  LocationProfile,
  LocationUpdatesHandle,
  type Position,
} from "expo-location/next";
import { Platform } from "react-native";
import { stopMapboxGuidance } from "./mapbox-bridge";
import { shouldAcceptPoint, type TrackPoint } from "../../../lib/geo";
import { trackDistanceKm, trackMaxSpeedKmh } from "./shared";
import {
  clearRideNotification,
  requestRideNotificationPermission,
} from "./ride-notification";
import {
  appendRidePoints,
  changeActiveRideStatus,
  continueRecordingAfterTrackingGap,
  getActiveRideMode as getStoredActiveRideMode,
  setActiveRideMode,
  discardActiveRide,
  loadActiveRide as loadStoredActiveRide,
  recoverInterruptedActiveRide,
  startOrResumeRide,
} from "./local-ride-store";
import { activeRideElapsedMs, type ActiveRideState, type RideMode } from "./ride-model";

const LEGACY_LOCATION_TASK_NAME = "adiv-ride-recorder";
export const LOCATION_TASK_NAME = "adiv-ride-recorder-v2";
export const MAX_ACCURACY_METERS = 50;
const RIDE_NOTIFICATION_REFRESH_INTERVAL_MS = 10_000;
const locationUpdates = new LocationUpdatesHandle(LOCATION_TASK_NAME)
  .withProfile(LocationProfile.AUTOMOTIVE_NAVIGATION);
const BACKGROUND_SESSION_NOTIFICATION = {
  notificationTitle: "ADiV · Ride recording",
  notificationBody: "Ride tracking is active.",
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
type RideTaskData = Position | LegacyLocationBatch | Location.LocationObject | Location.LocationObject[];

let activeRide: ActiveRideState | null = null;
let buffer: TrackPoint[] = [];
let loaded = false;
let loading: Promise<ActiveRideState | null> | null = null;
let reconciling: Promise<ActiveRideState | null> | null = null;
let lastRideNotificationUpdateAt = 0;
let lastRideNotificationKey = "";
const listeners = new Set<(point: TrackPoint) => void>();

function formatRideDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function foregroundNotificationBody(ride: ActiveRideState, now = Date.now()): string {
  const elapsedMs = activeRideElapsedMs(ride, now);
  const distanceKm = trackDistanceKm(ride.points);
  const averageSpeedKmh = elapsedMs > 0 ? distanceKm / (elapsedMs / 3_600_000) : 0;
  const maxSpeedKmh = trackMaxSpeedKmh(ride.points);
  return `Ride active · ${formatRideDuration(elapsedMs)} · ${distanceKm.toFixed(2)} km · avg ${averageSpeedKmh.toFixed(1)} km/h · max ${maxSpeedKmh > 0 ? `${maxSpeedKmh.toFixed(1)} km/h` : "—"}`;
}

async function refreshRideNotification(ride: ActiveRideState | null = activeRide): Promise<void> {
  if (!ride || (ride.status !== "recording" && ride.status !== "paused")) return;
  const now = Date.now();
  const notificationKey = `${ride.id}:${ride.status}`;
  if (notificationKey === lastRideNotificationKey
    && now - lastRideNotificationUpdateAt < RIDE_NOTIFICATION_REFRESH_INTERVAL_MS) return;

  lastRideNotificationKey = notificationKey;
  lastRideNotificationUpdateAt = now;
  if (Platform.OS === "android" && ride.status === "recording") {
    try {
      // SDK 58 re-posts the promoted location foreground notification with updated options.
      // Source: https://docs.expo.dev/versions/v58.0.0/sdk/location-next/#locationensurebackgroundsessionstarted
      await BackgroundLocation.ensureBackgroundSessionStarted({
        ...BACKGROUND_SESSION_NOTIFICATION,
        notificationBody: foregroundNotificationBody(ride, now),
      });
    } catch {
      // If Android has stopped the service, foreground reconciliation will restart it.
    }
  }
}

export async function refreshActiveRideNotification(): Promise<void> {
  const ride = await loadActiveRide();
  await refreshRideNotification(ride);
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
      try {
        await ensureLocationTaskStarted();
        return { ...ride, points: [...buffer] };
      } catch (error) {
        const interrupted = await markTrackingFailure(error);
        await refreshRideNotification(interrupted);
        return interrupted;
      }
    }

    // A missing GPS registration is a gap in the track, not a user pause.
    // Keep the ride active, account for elapsed time, and begin a new GPS run.
    ride = await continueRecordingAfterTrackingGap();
    if (!ride) return null;
    activeRide = ride;
    buffer = [...ride.points];

    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      return markTrackingFailure(new Error("Location permission was removed. Allow ADiV to use location while recording is active."));
    }
    if (Platform.OS === "android") {
      const backgroundPermission = await Location.getBackgroundPermissionsAsync();
      if (backgroundPermission.status !== "granted") {
        return markTrackingFailure(new Error("Allow ADiV to use location all the time so recording can continue when the app is in the background."));
      }
    }
    try {
      await ensureLocationTaskStarted();
    } catch (error) {
      return markTrackingFailure(error);
    }
    await refreshRideNotification(ride);
    return { ...ride, points: [...buffer] };
  })().finally(() => {
    reconciling = null;
  });
  return reconciling;
}

async function markTrackingFailure(error: unknown): Promise<ActiveRideState | null> {
  // Keep the persisted ride recording. Returning to the app retries the service;
  // only explicit Pause or End actions change this ride's recording state.
  const current = await loadStoredActiveRide();
  activeRide = current;
  buffer = current ? [...current.points] : [];
  if (!current) return null;
  await refreshRideNotification(current);
  return {
    ...current,
    trackingIssue: error instanceof Error
      ? error.message
      : "Android could not restart background GPS tracking. The ride remains active and ADiV will retry when it returns to the foreground.",
  };
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
      if (await Location.hasStartedLocationUpdatesAsync(LEGACY_LOCATION_TASK_NAME)) {
        await Location.stopLocationUpdatesAsync(LEGACY_LOCATION_TASK_NAME);
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
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LEGACY_LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LEGACY_LOCATION_TASK_NAME);
    }
  } catch {
    // Clean up registrations left by an older app version.
  }
}

async function locationTaskIsRunning(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "android") {
    try {
      const registered = await locationUpdates.hasStarted();
      const session = BackgroundLocation.getBackgroundSessionStatus();
      // Task status is process-local in SDK 58. A registered task plus a promoted
      // foreground service is the durable Android state across app restarts.
      return registered && session.unthrottled;
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
    // Migrate only the old task name. The SDK 58 handle has a distinct name so
    // the legacy API cannot unregister the active recorder task.
    try {
      if (await Location.hasStartedLocationUpdatesAsync(LEGACY_LOCATION_TASK_NAME)) {
        await Location.stopLocationUpdatesAsync(LEGACY_LOCATION_TASK_NAME);
      }
    } catch {
      // No legacy task needs migration.
    }
    const sessionNotification = activeRide
      ? { ...BACKGROUND_SESSION_NOTIFICATION, notificationBody: foregroundNotificationBody(activeRide) }
      : BACKGROUND_SESSION_NOTIFICATION;
    await BackgroundLocation.ensureBackgroundSessionStarted(sessionNotification);
    let session = BackgroundLocation.getBackgroundSessionStatus();
    const promoteBy = Date.now() + 2_000;
    while (!session.unthrottled && Date.now() < promoteBy) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      session = BackgroundLocation.getBackgroundSessionStatus();
    }
    if (!session.unthrottled) {
      throw new Error("Android did not start the ride location foreground service. Check ADiV's location permissions, then resume the ride.");
    }

    let registered = await locationUpdates.hasStarted();
    let taskStatus = locationUpdates.status();
    const retryProvider = registered && taskStatus.lastError !== null;
    if (retryProvider) {
      await locationUpdates.stop();
      registered = false;
    }
    if (!registered) {
      await locationUpdates.start();
      taskStatus = locationUpdates.status();
      if (!taskStatus.isRunning) {
        throw new Error(taskStatus.lastError ?? "Android registered the ride task but did not start GPS updates. Check location services and resume the ride.");
      }
    }
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
  defineLocationTask({
    taskName: LOCATION_TASK_NAME,
    onPosition: async (position) => {
      const data = position as unknown as RideTaskData;
      if (Array.isArray(data)) {
        await ingestLocations(data.map((location) => ({
          lat: location.coords.latitude,
          lon: location.coords.longitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          ts: location.timestamp,
        })));
      } else if ("coordinates" in data) {
        await ingestLocations([{
          lat: data.coordinates.latitude,
          lon: data.coordinates.longitude,
          accuracy: data.horizontalAccuracy,
          speed: data.speed,
          ts: data.timestamp,
        }]);
      } else if ("coords" in data) {
        await ingestLocations([{
          lat: data.coords.latitude,
          lon: data.coords.longitude,
          accuracy: data.coords.accuracy,
          speed: data.coords.speed,
          ts: data.timestamp,
        }]);
      } else {
        await ingestLocations(data.locations?.map((location) => ({
          lat: location.coords.latitude,
          lon: location.coords.longitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          ts: location.timestamp,
        })) ?? []);
      }
    },
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
    activeRide = await recoverInterruptedActiveRide();
    if (activeRide) buffer = [...activeRide.points];
    await refreshRideNotification(activeRide);
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
