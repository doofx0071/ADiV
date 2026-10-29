"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatCard } from "@/components/layout/stat-card";
import { OdometerEditor } from "@/components/maintenance/odometer-editor";
import {
  Gauge,
  Route,
  Fuel,
  Wallet,
  Wrench,
  CalendarCheck,
} from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import {
  evaluateMaintenanceItems,
  formatDueText,
  summarizeMaintenanceEvaluations,
} from "@/lib/reminders";

export function DashboardStats() {
  const bike = useQuery(api.bike.getBike);
  const rides = useQuery(api.rides.getRides, { limit: 100 });
  const fuelStats = useQuery(api.fuel.getFuelStats);
  const expenses = useQuery(api.expenses.getExpenses, { limit: 100 });
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);

  if (!bike || rides === undefined || fuelStats === undefined || expenses === undefined || maintenanceItems === undefined) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/purity -- capture render time; refreshes on every data update
  const now = Date.now();
  const monthStart = startOfMonth(now).getTime();
  const monthEnd = endOfMonth(now).getTime();
  const thisMonthRides = rides?.filter(
    (r) => r.date >= monthStart && r.date <= monthEnd
  ) ?? [];
  const thisMonthDistance = thisMonthRides.reduce((s, r) => s + r.distance, 0);

  // Calculate this month's expenses
  const thisMonthExpenses = expenses?.filter(
    (e) => e.date >= monthStart && e.date <= monthEnd
  ) ?? [];
  const totalExpenses = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);

  // Items serviced so far (honest count — on-time tracking is not recorded)
  const servicedCount = maintenanceItems?.filter((item) => item.lastServiceDate).length ?? 0;

  const maintenanceReadiness = evaluateMaintenanceItems(maintenanceItems, bike.currentOdometer, new Date(now));
  const maintenanceSummary = summarizeMaintenanceEvaluations(maintenanceReadiness);
  const nextDue = maintenanceReadiness.find((evaluation) =>
    evaluation.status === "overdue" ||
    evaluation.status === "due" ||
    evaluation.status === "upcoming"
  );
  const nextDueValue = nextDue
    ? nextDue.item.name
    : maintenanceSummary.needsHistory > 0
      ? "Needs history"
      : "Clear";
  const nextDueDescription = nextDue
    ? `${nextDue.status === "overdue" ? "Overdue" : nextDue.status === "due" ? "Due soon" : "Upcoming"} · ${formatDueText(nextDue)}${nextDue.historyComplete ? "" : " · Needs history"}`
    : maintenanceSummary.needsHistory > 0
      ? `${maintenanceSummary.needsHistory} item${maintenanceSummary.needsHistory === 1 ? "" : "s"} need confirmed service details`
      : `No scheduled service due soon · ${maintenanceSummary.historyComplete}/${maintenanceSummary.total} tracked`;

  return (
    <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <OdometerEditor
        currentOdometer={bike.currentOdometer}
        trigger={
          <button
            type="button"
            className="w-full cursor-pointer text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StatCard
              title="Current Odometer"
              value={`${bike.currentOdometer.toLocaleString()} km`}
              icon={<Gauge className="h-4 w-4" />}
            />
          </button>
        }
      />
      <StatCard
        title="This Month's Rides"
        value={`${thisMonthRides.length}`}
        description={`${thisMonthDistance.toLocaleString()} km total`}
        icon={<Route className="h-4 w-4" />}
      />
      <StatCard
        title="Fuel Efficiency"
        value={fuelStats.avgKmPerLiter > 0 ? `${fuelStats.avgKmPerLiter.toFixed(1)} km/L` : "—"}
        description="Across all fuel-ups"
        icon={<Fuel className="h-4 w-4" />}
      />
      <StatCard
        title="This Month's Expenses"
        value={`₱${totalExpenses.toLocaleString()}`}
        icon={<Wallet className="h-4 w-4" />}
      />
      <StatCard
        title="Items Serviced"
        value={`${servicedCount} items`}
        description="Of your maintenance list"
        icon={<Wrench className="h-4 w-4" />}
      />
      <Link
        href="/maintenance"
        aria-label={`Open maintenance center. ${nextDueDescription}`}
        className="block min-w-0 cursor-pointer rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StatCard
          title="Next Due"
          value={nextDueValue}
          description={nextDueDescription}
          icon={<CalendarCheck className="h-4 w-4" />}
          className="transition-colors hover:ring-primary/40"
        />
      </Link>
    </div>
    </>
  );
}
