import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MaintenanceBaselineItem, MaintenanceEvaluation } from "@/lib/shared";

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

const SETTINGS_KEY = "adiv.mobile.reminders";
const listeners = new Set<() => void>();

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

export async function enableReminderAt(hour: number, minute: number) {
  void hour;
  void minute;
  return false;
}

export async function disableReminder() {
  const current = await getReminderSettings();
  await updateReminderSettings({ ...current, enabled: false });
}

export async function syncDailyReminder<T extends MaintenanceBaselineItem>(evaluations: MaintenanceEvaluation<T>[]) {
  void evaluations;
}
