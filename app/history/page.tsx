"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Route, Fuel, Wallet } from "lucide-react";

export default function HistoryPage() {
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 100 });
  const rides = useQuery(api.rides.getRides, { limit: 100 });
  const fuelLogs = useQuery(api.fuel.getFuelLogs, { limit: 100 });
  const expenses = useQuery(api.expenses.getExpenses, { limit: 100 });

  const allActivities = [
    ...(maintenanceLogs?.map((log) => ({
      id: log._id,
      type: "maintenance" as const,
      title: `Maintenance — ${log.odometer.toLocaleString()} km`,
      date: log.date,
      cost: log.cost,
      icon: <Wrench className="h-4 w-4 text-primary" />,
      badge: log.cost ? `₱${log.cost.toLocaleString()}` : undefined,
    })) ?? []),
    ...(rides?.map((ride) => ({
      id: ride._id,
      type: "ride" as const,
      title: `Ride — ${ride.distance.toLocaleString()} km`,
      date: ride.date,
      cost: undefined,
      icon: <Route className="h-4 w-4 text-success" />,
      badge: `${ride.durationMinutes} min`,
    })) ?? []),
    ...(fuelLogs?.map((log) => ({
      id: log._id,
      type: "fuel" as const,
      title: `Fuel — ${log.liters.toFixed(1)} L`,
      date: log.date,
      cost: log.totalPrice,
      icon: <Fuel className="h-4 w-4 text-accent" />,
      badge: `₱${log.totalPrice.toFixed(0)}`,
    })) ?? []),
    ...(expenses?.map((expense) => ({
      id: expense._id,
      type: "expense" as const,
      title: `${expense.category} — ${expense.description || "Expense"}`,
      date: expense.date,
      cost: expense.amount,
      icon: <Wallet className="h-4 w-4 text-warning" />,
      badge: `₱${expense.amount.toLocaleString()}`,
    })) ?? []),
  ].sort((a, b) => b.date - a.date);

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader title="Service History" description="Chronological log of all activities" />

        <div className="space-y-3">
          {allActivities.length > 0 ? (
            allActivities.map((activity) => (
              <Card key={activity.id}>
                <CardContent className="flex items-center gap-4 py-4">
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
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No activity recorded yet. Start logging rides, fuel, maintenance, and expenses!
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
