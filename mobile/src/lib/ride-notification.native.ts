import * as Notifications from "expo-notifications";

const CHANNEL_ID = "ride-tracking";
const NOTIFICATION_ID = "adiv-active-ride";
const RECORDING_CATEGORY = "adiv_ride_recording";
const PAUSED_CATEGORY = "adiv_ride_paused";
const CONTROL_DATA_KEY = "adivRideControl";

export type RideNotificationAction = "pause" | "resume" | "end" | "open";

let permissionGranted: boolean | null = null;
let lastResponseKey = "";

function responseKey(response: Notifications.NotificationResponse): string {
  return `${response.notification.date}:${response.actionIdentifier}`;
}

function actionForResponse(response: Notifications.NotificationResponse): RideNotificationAction | null {
  if (response.notification.request.content.data?.[CONTROL_DATA_KEY] !== true) return null;
  if (response.actionIdentifier === "ride_pause") return "pause";
  if (response.actionIdentifier === "ride_resume") return "resume";
  if (response.actionIdentifier === "ride_end") return "end";
  return "open";
}

function actionsFor(phase: "recording" | "paused") {
  if (phase === "recording") {
    return [
      { identifier: "ride_pause", buttonTitle: "Pause", options: { opensAppToForeground: true } },
      { identifier: "ride_end", buttonTitle: "End ride", options: { opensAppToForeground: true } },
    ];
  }
  return [
    { identifier: "ride_resume", buttonTitle: "Resume", options: { opensAppToForeground: true } },
    { identifier: "ride_end", buttonTitle: "End ride", options: { opensAppToForeground: true } },
  ];
}

export async function registerRideNotificationActions(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Ride tracking",
    description: "Live distance, duration, and recorder controls",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: [],
    showBadge: false,
  });
  await Notifications.setNotificationCategoryAsync(RECORDING_CATEGORY, actionsFor("recording"));
  await Notifications.setNotificationCategoryAsync(PAUSED_CATEGORY, actionsFor("paused"));
}

export async function requestRideNotificationPermission(): Promise<boolean> {
  if (permissionGranted !== null) return permissionGranted;
  try {
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    permissionGranted = permission.granted;
    return permissionGranted;
  } catch {
    permissionGranted = false;
    return false;
  }
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export async function updateRideNotification(input: {
  phase: "recording" | "paused";
  elapsedMs: number;
  distanceKm: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
}): Promise<void> {
  try {
    if (permissionGranted === null) {
      permissionGranted = (await Notifications.getPermissionsAsync()).granted;
    }
    if (!permissionGranted) return;
    const isRecording = input.phase === "recording";
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: isRecording ? "ADiV · Recording ride" : "ADiV · Ride paused",
        body: `${formatDuration(input.elapsedMs)} · ${input.distanceKm.toFixed(2)} km · avg ${input.averageSpeedKmh.toFixed(1)} · max ${input.maxSpeedKmh > 0 ? input.maxSpeedKmh.toFixed(1) : "—"} km/h`,
        sticky: true,
        color: "#e62025",
        categoryIdentifier: isRecording ? RECORDING_CATEGORY : PAUSED_CATEGORY,
        data: { [CONTROL_DATA_KEY]: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    // The foreground location service remains active if this optional control
    // notification cannot be presented by the device or its notification policy.
  }
}

export async function clearRideNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // It is already absent or the OS notification permission was revoked.
  }
}

export function subscribeToRideNotificationActions(
  listener: (action: RideNotificationAction) => void,
): { remove: () => void } {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const key = responseKey(response);
    if (key === lastResponseKey) return;
    const action = actionForResponse(response);
    if (!action) return;
    lastResponseKey = key;
    listener(action);
  });
}

export function getLastRideNotificationAction(): RideNotificationAction | null {
  const response = Notifications.getLastNotificationResponse();
  if (!response) return null;
  const action = actionForResponse(response);
  if (action) lastResponseKey = responseKey(response);
  return action;
}

export function clearLastRideNotificationAction(): void {
  Notifications.clearLastNotificationResponse();
}
