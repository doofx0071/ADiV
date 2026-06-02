"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatCard } from "@/components/layout/stat-card";
import {
  Gauge,
  Route,
  Fuel,
  Wallet,
  Wrench,
  CalendarCheck,
} from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";

export function DashboardStats() {
  const bike = useQuery(api.bike.getBike);
  const rides = useQuery(api.rides.getRides, { limit: 100 });
  const fuelLogs = useQuery(api.fuel.getFuelLogs, { limit: 10 });
  const expenses = useQuery(api.expenses.getExpenses, { limit: 100 });
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);

  if (!bike || rides === undefined || fuelLogs === undefined || expenses === undefined || maintenanceItems === undefined) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  // Calculate this month's rides
  const now = Date.now();
  const monthStart = startOfMonth(now).getTime();
  const monthEnd = endOfMonth(now).getTime();
  const thisMonthRides = rides?.filter(
    (r) => r.date >= monthStart && r.date <= monthEnd
  ) ?? [];
  const thisMonthDistance = thisMonthRides.reduce((s, r) => s + r.distance, 0);

  // Calculate fuel efficiency from last 3 fuel-ups
  const recentFuel = fuelLogs?.slice(0, 3) ?? [];
  const avgEfficiency =
    recentFuel.length >= 2
      ? recentFuel
          .slice(1)
          .map((log, i) => {
            const distance = log.odometer - recentFuel[i].odometer;
            return distance / log.liters;
          })
          .reduce((s, e) => s + e, 0) /
        (recentFuel.length - 1)
      : 0;

  // Calculate this month's expenses
  const thisMonthExpenses = expenses?.filter(
    (e) => e.date >= monthStart && e.date <= monthEnd
  ) ?? [];
  const totalExpenses = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);

  // Calculate maintenance streak (consecutive on-time services)
  const logs = maintenanceItems
    ?.filter((item) => item.lastServiceDate)
    .sort((a, b) => (b.lastServiceDate ?? 0) - (a.lastServiceDate ?? 0));
  const streak = logs?.length ?? 0;

  // Find next due task
  const upcomingItems = maintenanceItems
    ?.filter((item) => item.intervalKm || item.intervalMonths)
    .map((item) => {
      const dueKm = item.intervalKm && item.lastServiceOdometer
        ? item.lastServiceOdometer + item.intervalKm - bike.currentOdometer
        : null;
      const dueDays = item.intervalMonths && item.lastServiceDate
        ? Math.ceil(
            (item.lastServiceDate + item.intervalMonths * 30 * 24 * 60 * 60 * 1000 - now) /
              (24 * 60 * 60 * 1000)
          )
        : null;
      return { ...item, dueKm, dueDays };
    })
    .filter((item) => (item.dueKm !== null && item.dueKm <= 1000) || (item.dueDays !== null && item.dueDays <= 30))
    .sort((a, b) => {
      const aUrgency = Math.min(a.dueKm ?? Infinity, (a.dueDays ?? Infinity) * 100);
      const bUrgency = Math.min(b.dueKm ?? Infinity, (b.dueDays ?? Infinity) * 100);
      return aUrgency - bUrgency;
    });

  const nextDue = upcomingItems?.[0];
  const nextDueLabel = nextDue
    ? nextDue.dueKm !== null && nextDue.dueKm >= 0
      ? `${nextDue.name} — ${nextDue.dueKm}km`
      : nextDue.dueDays !== null && nextDue.dueDays >= 0
      ? `${nextDue.name} — ${nextDue.dueDays}d`
      : `${nextDue.name} — overdue`
    : "All good!";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Current Odometer"
        value={`${bike.currentOdometer.toLocaleString()} km`}
        icon={<Gauge className="h-4 w-4" />}
      />
      <StatCard
        title="This Month's Rides"
        value={`${thisMonthRides.length}`}
        description={`${thisMonthDistance.toLocaleString()} km total`}
        icon={<Route className="h-4 w-4" />}
      />
      <StatCard
        title="Fuel Efficiency"
        value={avgEfficiency > 0 ? `${avgEfficiency.toFixed(1)} km/L` : "—"}
        description="Last 3 fuel-ups"
        icon={<Fuel className="h-4 w-4" />}
      />
      <StatCard
        title="This Month's Expenses"
        value={`₱${totalExpenses.toLocaleString()}`}
        icon={<Wallet className="h-4 w-4" />}
      />
      <StatCard
        title="Maintenance Streak"
        value={`${streak} items`}
        description="Serviced on time"
        icon={<Wrench className="h-4 w-4" />}
      />
      <StatCard
        title="Next Due"
        value={nextDueLabel}
        icon={<CalendarCheck className="h-4 w-4" />}
      />
    </div>
  );
}
