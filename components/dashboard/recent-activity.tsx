"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wrench,
  Route,
  Fuel,
  Wallet,
  CircleDot,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: "maintenance" | "ride" | "fuel" | "expense";
  title: string;
  subtitle: string;
  date: number;
  icon: React.ReactNode;
}

export function RecentActivity() {
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 20 });
  const rides = useQuery(api.rides.getRides, { limit: 20 });
  const fuelLogs = useQuery(api.fuel.getFuelLogs, { limit: 20 });
  const expenses = useQuery(api.expenses.getExpenses, { limit: 20 });

  if (
    maintenanceLogs === undefined ||
    rides === undefined ||
    fuelLogs === undefined ||
    expenses === undefined
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activities: ActivityItem[] = [
    ...(maintenanceLogs?.map((log) => ({
      id: log._id,
      type: "maintenance" as const,
      title: "Maintenance",
      subtitle: `${log.odometer.toLocaleString()} km`,
      date: log.date,
      icon: <Wrench className="h-4 w-4 text-primary" />,
    })) ?? []),
    ...(rides?.map((ride) => ({
      id: ride._id,
      type: "ride" as const,
      title: "Ride",
      subtitle: `${ride.distance.toLocaleString()} km`,
      date: ride.date,
      icon: <Route className="h-4 w-4 text-success" />,
    })) ?? []),
    ...(fuelLogs?.map((log) => ({
      id: log._id,
      type: "fuel" as const,
      title: "Fuel",
      subtitle: `${log.liters.toFixed(1)} L · ₱${log.totalPrice.toFixed(0)}`,
      date: log.date,
      icon: <Fuel className="h-4 w-4 text-accent" />,
    })) ?? []),
    ...(expenses?.map((expense) => ({
      id: expense._id,
      type: "expense" as const,
      title: expense.category,
      subtitle: `₱${expense.amount.toLocaleString()}`,
      date: expense.date,
      icon: <Wallet className="h-4 w-4 text-warning" />,
    })) ?? []),
  ]
    .sort((a, b) => b.date - a.date)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CircleDot className="h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  {activity.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">{activity.subtitle}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(activity.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity yet. Start logging!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
