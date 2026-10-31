/**
 * Browser notification utilities for AdiV maintenance reminders.
 */

const NOTIFICATION_PERMISSION_KEY = "adiv-notification-permission";

/**
 * Check if browser notifications are supported.
 */
export function areNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get the current notification permission status.
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!areNotificationsSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Request permission to show browser notifications.
 * Returns true if permission was granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!areNotificationsSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    localStorage.setItem(NOTIFICATION_PERMISSION_KEY, permission);
    if (permission === "granted" && "serviceWorker" in navigator) {
      await getNotificationRegistration();
    }
    return permission === "granted";
  } catch {
    return false;
  }
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | undefined;

async function getNotificationRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  registrationPromise ??= navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .catch(() => null);
  return registrationPromise;
}

async function displayNotification(title: string, options: NotificationOptions): Promise<void> {
  try {
    const registration = await getNotificationRegistration();
    if (registration && "showNotification" in registration) {
      await registration.showNotification(title, options);
      return;
    }

    // The Notification constructor is a desktop fallback; mobile browsers
    // generally require ServiceWorkerRegistration.showNotification().
    new Notification(title, options);
  } catch {
    // Browser notification support is optional; in-app reminders remain available.
  }
}

/**
 * Show a browser notification for due maintenance.
 */
export async function showMaintenanceNotification(
  itemName: string,
  dueInfo: string
): Promise<void> {
  if (!areNotificationsSupported() || Notification.permission !== "granted") return;
  await displayNotification("AdiV Maintenance Reminder", {
      body: `${itemName} is ${dueInfo}`,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: `maintenance-${itemName}`,
      requireInteraction: false,
      data: { url: "/dashboard" },
  });
}

/**
 * Show a batch notification summarizing multiple due items.
 */
export async function showBatchMaintenanceNotification(
  overdueCount: number,
  dueCount: number
): Promise<void> {
  if (!areNotificationsSupported() || Notification.permission !== "granted") return;

  const total = overdueCount + dueCount;
  if (total === 0) return;

  let body: string;
  if (overdueCount > 0 && dueCount > 0) {
    body = `${overdueCount} overdue and ${dueCount} due maintenance items need attention.`;
  } else if (overdueCount > 0) {
    body = `${overdueCount} maintenance item${overdueCount > 1 ? "s are" : " is"} overdue.`;
  } else {
    body = `${dueCount} maintenance item${dueCount > 1 ? "s are" : " is"} due soon.`;
  }

  await displayNotification("AdiV Maintenance Alert", {
      body,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: "maintenance-batch",
      requireInteraction: false,
      data: { url: "/dashboard" },
  });
}
