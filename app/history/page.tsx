"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogActions, type HistoryLog } from "@/components/history/log-actions";
import { Wrench, Route, Fuel, Wallet } from "lucide-react";

type ActivityType = "maintenance" | "ride" | "fuel" | "expense";

const FILTERS: { value: ActivityType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "maintenance", label: "Maintenance" },
  { value: "ride", label: "Rides" },
  { value: "fuel", label: "Fuel" },
  { value: "expense", label: "Expenses" },
];

export default function HistoryPage() {
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 100 });
  const rides = useQuery(api.rides.getRides, { limit: 100 });
  const fuelLogs = useQuery(api.fuel.getFuelLogs, { limit: 100 });
  const expenses = useQuery(api.expenses.getExpenses, { limit: 100 });
  const [filter, setFilter] = useState<ActivityType | "all">("all");

  const allActivities: {
    id: string;
    type: ActivityType;
    title: string;
    date: number;
    badge?: string;
    icon: React.ReactNode;
    log: HistoryLog;
  }[] = [
    ...(maintenanceLogs?.map((log) => ({
      id: log._id,
      type: "maintenance" as const,
      title: `${log.itemName ?? "Maintenance"} — ${log.odometer.toLocaleString()} km`,
      date: log.date,
      badge: log.cost ? `₱${log.cost.toLocaleString()}` : undefined,
      icon: <Wrench className="h-4 w-4 text-primary" />,
      log: {
        type: "maintenance" as const,
        id: log._id,
        cost: log.cost,
        notes: log.notes,
      },
    })) ?? []),
    ...(rides?.map((ride) => ({
      id: ride._id,
      type: "ride" as const,
      title: `Ride — ${ride.distance.toLocaleString()} km`,
      date: ride.date,
      badge: `${ride.durationMinutes} min`,
      icon: <Route className="h-4 w-4 text-success" />,
      log: { type: "ride" as const, id: ride._id, notes: ride.notes },
    })) ?? []),
    ...(fuelLogs?.map((log) => ({
      id: log._id,
      type: "fuel" as const,
      title: `Fuel — ${log.liters.toFixed(1)} L`,
      date: log.date,
      badge: `₱${log.totalPrice.toFixed(0)}`,
      icon: <Fuel className="h-4 w-4 text-accent" />,
      log: {
        type: "fuel" as const,
        id: log._id,
        stationName: log.stationName,
        notes: log.notes,
      },
    })) ?? []),
    ...(expenses?.map((expense) => ({
      id: expense._id,
      type: "expense" as const,
      title: `${expense.category} — ${expense.description || "Expense"}`,
      date: expense.date,
      badge: `₱${expense.amount.toLocaleString()}`,
      icon: <Wallet className="h-4 w-4 text-warning" />,
      log: {
        type: "expense" as const,
        id: expense._id,
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
      },
    })) ?? []),
  ].sort((a, b) => b.date - a.date);

  const visible = filter === "all" ? allActivities : allActivities.filter((a) => a.type === filter);

  return (
    <main className="flex flex-col p-3 sm:p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader title="Service History" description="Chronological log of all activities" />

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by activity type">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {visible.length > 0 ? (
            visible.map((activity) => (
              <Card key={activity.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-4 sm:flex-nowrap sm:gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                    {activity.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  {activity.badge && (
                    <Badge variant="secondary">{activity.badge}</Badge>
                  )}
                  <LogActions log={activity.log} />
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {filter === "all"
                  ? "No activity recorded yet. Start logging rides, fuel, maintenance, and expenses!"
                  : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} entries yet.`}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
