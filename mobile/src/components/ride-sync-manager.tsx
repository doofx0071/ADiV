import { useEffect } from "react";
import { AppState } from "react-native";
import { flushRideOutbox } from "@/lib/ride-sync";
import { reconcileActiveRecording, refreshActiveRideNotification } from "@/lib/ride-tracker";
import { clearRideNotification } from "@/lib/ride-notification";

export function RideSyncManager() {
  useEffect(() => {
    const sync = () => void flushRideOutbox().catch(() => undefined);
    const reconcileRecording = () => void reconcileActiveRecording().catch(() => undefined);
    sync();
    reconcileRecording();
    // Remove the old interactive ride card left by earlier app versions.
    void clearRideNotification().catch(() => undefined);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sync();
        reconcileRecording();
      }
    });
    const interval = setInterval(sync, 30_000);
    const notificationInterval = setInterval(() => {
      void refreshActiveRideNotification().catch(() => undefined);
    }, 10_000);
    return () => {
      subscription.remove();
      clearInterval(interval);
      clearInterval(notificationInterval);
    };
  }, []);

  return null;
}
