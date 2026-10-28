"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/layout/status-badge";
import { Wrench, Bell, BellOff } from "lucide-react";
import {
  calculateStatus,
  formatDueText,
} from "@/lib/reminders";
import {
  areNotificationsSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showBatchMaintenanceNotification,
} from "@/lib/notifications";

// Notification permission is a browser-owned store; subscribers re-read
// it after requestNotificationPermission resolves.
const permissionListeners = new Set<() => void>();
function subscribeToPermission(onChange: () => void) {
  permissionListeners.add(onChange);
  return () => {
    permissionListeners.delete(onChange);
  };
}
function notifyPermissionChanged() {
  permissionListeners.forEach((listener) => listener());
}

export function UpcomingTasksWidget() {
  const bike = useQuery(api.bike.getBike);
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);
  const permission = useSyncExternalStore(
    subscribeToPermission,
    () => getNotificationPermission(),
    () => "unsupported" as const
  );
  const notifiedRef = useRef(false);

  // Send one batch reminder per session when permission is granted
  useEffect(() => {
    if (!bike || maintenanceItems === undefined || permission !== "granted" || notifiedRef.current) {
      return;
    }
    const now = Date.now();
    const statuses = maintenanceItems
      .filter((item) => item.lastServiceDate && (item.intervalKm || item.intervalMonths))
      .map((item) =>
        calculateStatus(
          bike.currentOdometer,
          new Date(now),
          item.lastServiceOdometer ?? 0,
          new Date(item.lastServiceDate ?? now),
          item.intervalKm ?? null,
          item.intervalMonths
        )
      );
    const overdue = statuses.filter((s) => s.status === "overdue").length;
    const due = statuses.filter((s) => s.status === "due").length;
    if (overdue + due > 0) {
      notifiedRef.current = true;
      showBatchMaintenanceNotification(overdue, due);
    }
  }, [bike, maintenanceItems, permission]);

  const handleEnableNotifications = async () => {
    await requestNotificationPermission();
    notifyPermissionChanged();
  };

  if (!bike || maintenanceItems === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // eslint-disable-next-line react-hooks/purity -- capture render time; refreshes on every data update
  const now = Date.now();
  const upcoming = maintenanceItems
    ?.filter((item) => item.lastServiceDate && (item.intervalKm || item.intervalMonths))
    .map((item) => {
      const status = calculateStatus(
        bike.currentOdometer,
        new Date(now),
        item.lastServiceOdometer ?? 0,
        new Date(item.lastServiceDate ?? now),
        item.intervalKm ?? null,
        item.intervalMonths
      );
      return { ...item, status };
    })
    .filter((item) => item.status.status !== "upcoming" || (item.status.dueInKm !== null && item.status.dueInKm <= 1000) || (item.status.dueInDays !== null && item.status.dueInDays <= 30))
    .sort((a, b) => {
      const priority = { overdue: 0, due: 1, upcoming: 2 };
      return priority[a.status.status] - priority[b.status.status];
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Upcoming Tasks
          {areNotificationsSupported() && permission === "default" && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1.5 text-xs"
              onClick={handleEnableNotifications}
            >
              <Bell className="h-3.5 w-3.5" />
              Enable reminders
            </Button>
          )}
          {areNotificationsSupported() && permission === "denied" && (
            <BellOff className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming && upcoming.length > 0 ? (
          <div className="space-y-3">
            {upcoming.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-1 min-w-0">
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDueText(item.status)}</p>
                </div>
                <StatusBadge status={item.status.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No upcoming tasks. Your bike is in great shape!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
