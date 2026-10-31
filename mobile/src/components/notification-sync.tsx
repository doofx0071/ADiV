import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { syncDailyReminder, subscribeReminderSettings } from "@/lib/notifications";
import { evaluateMaintenanceItems } from "@/lib/shared";

export function NotificationSync() {
  const bike = useQuery(api.bike.getBike);
  const items = useQuery(api.maintenance.getMaintenanceItems);
  const [isActive, setIsActive] = useState(AppState.currentState === "active");
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setIsActive(state === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => subscribeReminderSettings(() => setSettingsVersion((version) => version + 1)), []);

  useEffect(() => {
    if (!isActive || bike === undefined || items === undefined) return;
    const evaluations = bike
      ? evaluateMaintenanceItems(items, bike.currentOdometer, new Date())
      : [];
    void syncDailyReminder(evaluations).catch(() => undefined);
  }, [bike, items, isActive, settingsVersion]);

  return null;
}
