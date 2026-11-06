import * as Notifications from "expo-notifications";

const LEGACY_NOTIFICATION_ID = "adiv-active-ride";

let permissionGranted: boolean | null = null;

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

/** Remove the separate interactive card used before ride stats moved to the FGS card. */
export async function clearRideNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(LEGACY_NOTIFICATION_ID);
    await Notifications.cancelScheduledNotificationAsync(LEGACY_NOTIFICATION_ID);
  } catch {
    // The legacy card is already absent or notifications are unavailable.
  }
}
