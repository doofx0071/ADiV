/**
 * Writes the home-screen widget snapshot whenever app data changes (mirrors
 * the NotificationSync pattern): current odometer + the most urgent
 * maintenance item, colored by reminder status.
 */
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { evaluateMaintenanceItem, formatDueText } from "@/lib/shared";
import { saveWidgetSnapshot } from "@/widgets/adiv-widget";
import { pushWidgetUpdate } from "@/widgets/widget-update";

const STATUS_COLORS: Record<string, `#${string}`> = {
  overdue: "#ff5a5f",
  due: "#f59e0b",
  upcoming: "#e62025",
  clear: "#22c55e",
  "needs-history": "#8b8b98",
};

const STATUS_ORDER: Record<string, number> = {
  overdue: 0,
  due: 1,
  upcoming: 2,
  "needs-history": 3,
  clear: 4,
};

export function WidgetSync() {
  const bike = useQuery(api.bike.getBike);
  const items = useQuery(api.maintenance.getMaintenanceItems);

  useEffect(() => {
    if (!bike || !items) return;
    const now = new Date();
    const evaluated = items
      .map((item) => evaluateMaintenanceItem(item, bike.currentOdometer, now))
      .sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
          (a.dueInKm ?? Number.MAX_SAFE_INTEGER) - (b.dueInKm ?? Number.MAX_SAFE_INTEGER),
      );
    const mostUrgent = evaluated[0];
    if (!mostUrgent) return;

    const snapshot = {
      odometerKm: bike.currentOdometer,
      itemName: mostUrgent.item.name,
      dueText: formatDueText(mostUrgent),
      statusColor: STATUS_COLORS[mostUrgent.status] ?? "#8b8b98",
      updatedAt: Date.now(),
    } as const;
    // Persist the snapshot AND push a redraw so the placed widget repaints
    // immediately instead of waiting for Android's next update tick.
    void (async () => {
      await saveWidgetSnapshot(snapshot).catch(() => {});
      await pushWidgetUpdate(snapshot);
    })();
  }, [bike, items]);

  return null;
}
