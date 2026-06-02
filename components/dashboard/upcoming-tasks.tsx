"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/layout/status-badge";
import { Wrench } from "lucide-react";
import { calculateStatus } from "@/lib/reminders";

export function UpcomingTasksWidget() {
  const bike = useQuery(api.bike.getBike);
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);

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
                <div className="space-y-1">
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.status.dueInKm !== null && item.status.dueInKm >= 0
                      ? `Due in ${item.status.dueInKm} km`
                      : item.status.dueInDays !== null && item.status.dueInDays >= 0
                      ? `Due in ${item.status.dueInDays} days`
                      : item.status.dueInKm !== null && item.status.dueInKm < 0
                      ? `Overdue by ${Math.abs(item.status.dueInKm)} km`
                      : `Overdue by ${Math.abs(item.status.dueInDays ?? 0)} days`}
                  </p>
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
