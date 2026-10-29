"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MaintenanceItemRow } from "@/components/maintenance/maintenance-item-row";
import { OdometerEditor } from "@/components/maintenance/odometer-editor";
import { LogModal } from "@/components/dashboard/log-modals";
import { Bell, BellOff, Gauge, Wrench } from "lucide-react";
import { evaluateMaintenanceItems, summarizeMaintenanceEvaluations } from "@/lib/reminders";
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
  const [logTarget, setLogTarget] = useState<{
    itemId: Id<"maintenanceItems">;
    mode: "service" | "history";
  } | null>(null);
  const permission = useSyncExternalStore(
    subscribeToPermission,
    () => getNotificationPermission(),
    () => "unsupported" as const
  );
  const notifiedRef = useRef(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const evaluations = useMemo(
    () => bike && maintenanceItems
      ? evaluateMaintenanceItems(maintenanceItems, bike.currentOdometer, now)
      : [],
    [bike, maintenanceItems, now]
  );
  const summary = summarizeMaintenanceEvaluations(evaluations);
  const urgentTasks = evaluations.filter((evaluation) =>
    evaluation.status === "overdue" ||
    evaluation.status === "due" ||
    evaluation.status === "upcoming"
  );
  const historyNeeded = evaluations.filter((evaluation) => !evaluation.historyComplete);

  // Send one batch reminder per session when permission is granted
  useEffect(() => {
    if (!bike || maintenanceItems === undefined || permission !== "granted" || notifiedRef.current) {
      return;
    }
    const overdue = evaluations.filter((evaluation) => evaluation.knownStatus === "overdue").length;
    const due = evaluations.filter((evaluation) => evaluation.knownStatus === "due").length;
    if (overdue + due > 0) {
      notifiedRef.current = true;
      showBatchMaintenanceNotification(overdue, due);
    }
  }, [bike, maintenanceItems, evaluations, permission]);

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

  const topTasks = urgentTasks.slice(0, 5);

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5 text-primary" aria-hidden="true" />
              Upcoming Tasks
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <OdometerEditor
                currentOdometer={bike.currentOdometer}
                trigger={
                  <Button type="button" variant="outline" className="min-h-11 cursor-pointer gap-1.5 px-3 sm:min-h-9">
                    <Gauge aria-hidden="true" />Update odometer
                  </Button>
                }
              />
              {areNotificationsSupported() && permission === "default" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 cursor-pointer gap-1.5 px-3 text-xs sm:min-h-9"
                  onClick={handleEnableNotifications}
                >
                  <Bell aria-hidden="true" className="h-3.5 w-3.5" />
                  Enable reminders
                </Button>
              )}
              {areNotificationsSupported() && permission === "denied" && (
                <span className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs text-muted-foreground sm:min-h-9" title="Browser notifications are disabled">
                  <BellOff aria-hidden="true" className="h-4 w-4" />Notifications off
                </span>
              )}
              <Button asChild variant="secondary" className="min-h-11 cursor-pointer px-3 sm:min-h-9">
                <Link href="/maintenance">View all</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Maintenance summary">
            <SummaryCount label="Overdue" value={summary.overdue} tone="destructive" />
            <SummaryCount label="Due soon" value={summary.due} tone="warning" />
            <SummaryCount label="Upcoming" value={summary.upcoming} tone="success" />
            <SummaryCount label="Needs history" value={summary.needsHistory} tone="muted" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {topTasks.length > 0 ? (
            <div className="space-y-3">
              {topTasks.map((evaluation) => (
                <MaintenanceItemRow
                  key={evaluation.item._id}
                  evaluation={evaluation}
                  onLogService={(itemId, mode) => setLogTarget({ itemId, mode })}
                />
              ))}
            </div>
          ) : summary.needsHistory > 0 ? (
            <div className="flex flex-col gap-3 border border-warning/40 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-medium text-sm">Service history needed</p>
                <p className="text-xs text-muted-foreground">
                  Reminders can’t be confirmed for {summary.needsHistory} of {summary.total} items yet.
                </p>
              </div>
              <Button asChild variant="outline" className="min-h-11 cursor-pointer sm:min-h-9">
                <Link href="/maintenance?filter=needs-history">Review history</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-1 py-2 text-center" role="status">
              <p className="text-sm font-medium">No scheduled service due soon.</p>
              <p className="text-xs text-muted-foreground">
                All {summary.total} maintenance items have confirmed service history.
              </p>
            </div>
          )}

          {topTasks.length > 0 && historyNeeded.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {historyNeeded.length} item{historyNeeded.length === 1 ? "" : "s"} still need confirmed service history.
              </p>
              <Button asChild variant="link" className="min-h-11 cursor-pointer self-start px-0 sm:min-h-9">
                <Link href="/maintenance?filter=needs-history">Review history</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {logTarget && <LogModal
        key={`${logTarget.itemId}-${logTarget.mode}`}
        type="maintenance"
        onClose={() => setLogTarget(null)}
        initialMaintenanceItemId={logTarget.itemId}
        maintenanceEntryMode={logTarget.mode}
      />}
    </>
  );
}

function SummaryCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "destructive" | "warning" | "success" | "muted";
}) {
  const toneClass = {
    destructive: "text-destructive",
    warning: "text-warning",
    success: "text-success",
    muted: "text-muted-foreground",
  }[tone];

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 border border-foreground/10 px-3 py-2">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <Badge variant="outline" className={`shrink-0 ${toneClass}`}>{value}</Badge>
    </div>
  );
}
