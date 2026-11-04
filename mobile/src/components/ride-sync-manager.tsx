import { useEffect } from "react";
import { AppState } from "react-native";
import { router, useSegments } from "expo-router";
import { flushRideOutbox } from "@/lib/ride-sync";
import { getActiveRideMode, handleRideNotificationAction, reconcileActiveRecording } from "@/lib/ride-tracker";
import {
  clearLastRideNotificationAction,
  getLastRideNotificationAction,
  registerRideNotificationActions,
  subscribeToRideNotificationActions,
  type RideNotificationAction,
} from "@/lib/ride-notification";

export function RideSyncManager() {
  const segments = useSegments();
  useEffect(() => {
    const sync = () => void flushRideOutbox().catch(() => undefined);
    const reconcileRecording = () => void reconcileActiveRecording().catch(() => undefined);
    sync();
    reconcileRecording();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sync();
        reconcileRecording();
      }
    });
    const interval = setInterval(sync, 30_000);
    let handlingAction = false;
    const handleAction = async (action: RideNotificationAction) => {
      if (handlingAction) return;
      handlingAction = true;
      try {
        if (action !== "open") await handleRideNotificationAction(action);
        clearLastRideNotificationAction();
        if (segments[segments.length - 1] !== "record") {
          const mode = await getActiveRideMode();
          router.push({ pathname: "/record", params: { mode: mode ?? "recordOnly" } });
        }
      } catch {
        // The recorder remains available in-app if an OEM rejects a shade action.
        void getActiveRideMode().then((mode) => {
          router.push({ pathname: "/record", params: { mode: mode ?? "recordOnly" } });
        }).catch(() => router.push({ pathname: "/record", params: { mode: "recordOnly" } }));
      } finally {
        handlingAction = false;
      }
    };
    void registerRideNotificationActions().catch(() => undefined);
    const actionSubscription = subscribeToRideNotificationActions((action) => void handleAction(action));
    const lastAction = getLastRideNotificationAction();
    if (lastAction) void handleAction(lastAction);
    return () => {
      subscription.remove();
      actionSubscription.remove();
      clearInterval(interval);
    };
  }, [segments]);

  return null;
}
