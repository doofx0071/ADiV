import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { MaintenanceBaselineItem, MaintenanceEvaluation } from "@/lib/shared";

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

const SETTINGS_KEY = "adiv.mobile.reminders";
const CHANNEL_ID = "maintenance-reminders";
const listeners = new Set<() => void>();
let lastScheduleSignature = "";

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: false, hour: 8, minute: 0 };

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_REMINDER_SETTINGS;
    const parsed = JSON.parse(stored) as Partial<ReminderSettings>;
    return {
      enabled: parsed.enabled === true,
      hour: Number.isInteger(parsed.hour) ? Math.min(23, Math.max(0, parsed.hour as number)) : 8,
      minute: Number.isInteger(parsed.minute) ? Math.min(59, Math.max(0, parsed.minute as number)) : 0,
    };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function updateReminderSettings(settings: ReminderSettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  for (const listener of listeners) listener();
}

export function subscribeReminderSettings(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

async function prepareChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Maintenance reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: "#e62025",
    });
  }
}

export async function enableReminderAt(hour: number, minute: number) {
  await prepareChannel();
  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) permissions = await Notifications.requestPermissionsAsync();
  if (!permissions.granted) return false;
  await updateReminderSettings({ enabled: true, hour, minute });
  return true;
}

export async function disableReminder() {
  const current = await getReminderSettings();
  await updateReminderSettings({ ...current, enabled: false });
}

export async function syncDailyReminder<T extends MaintenanceBaselineItem>(evaluations: MaintenanceEvaluation<T>[]) {
  const settings = await getReminderSettings();
  if (!settings.enabled) {
    if (lastScheduleSignature !== "disabled") await Notifications.cancelAllScheduledNotificationsAsync();
    lastScheduleSignature = "disabled";
    return;
  }

  await prepareChannel();
  const attentionCount = evaluations.filter((item) => item.status === "overdue" || item.status === "due").length;
  const title = attentionCount > 0 ? "Your ADV160 needs attention" : "Your ADV160 maintenance check-in";
  const body = attentionCount > 0
    ? `${attentionCount} maintenance ${attentionCount === 1 ? "item is" : "items are"} due or overdue. Review the schedule before your next ride.`
    : "Review your maintenance schedule and keep your service history current.";
  const signature = `${settings.hour}:${settings.minute}|${title}|${body}`;
  if (signature === lastScheduleSignature) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { screen: "maintenance" },
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: settings.hour,
      minute: settings.minute,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
  });
  lastScheduleSignature = signature;
}
