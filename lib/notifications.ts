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
    return permission === "granted";
  } catch {
    return false;
  }
}

/**
 * Show a browser notification for due maintenance.
 */
export function showMaintenanceNotification(
  itemName: string,
  dueInfo: string
): Notification | null {
  if (!areNotificationsSupported()) return null;
  if (Notification.permission !== "granted") return null;

  try {
    const notification = new Notification("AdiV Maintenance Reminder", {
      body: `${itemName} is ${dueInfo}`,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: `maintenance-${itemName}`,
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch {
    return null;
  }
}

/**
 * Show a batch notification summarizing multiple due items.
 */
export function showBatchMaintenanceNotification(
  overdueCount: number,
  dueCount: number
): Notification | null {
  if (!areNotificationsSupported()) return null;
  if (Notification.permission !== "granted") return null;

  const total = overdueCount + dueCount;
  if (total === 0) return null;

  let body: string;
  if (overdueCount > 0 && dueCount > 0) {
    body = `${overdueCount} overdue and ${dueCount} due maintenance items need attention.`;
  } else if (overdueCount > 0) {
    body = `${overdueCount} maintenance item${overdueCount > 1 ? "s are" : " is"} overdue.`;
  } else {
    body = `${dueCount} maintenance item${dueCount > 1 ? "s are" : " is"} due soon.`;
  }

  try {
    const notification = new Notification("AdiV Maintenance Alert", {
      body,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: "maintenance-batch",
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      window.location.href = "/dashboard";
      notification.close();
    };

    return notification;
  } catch {
    return null;
  }
}
