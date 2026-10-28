"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { CostChart } from "@/components/charts/cost-chart";
import { FuelEfficiencyChart } from "@/components/charts/fuel-efficiency-chart";
import { MaintenanceFrequencyChart } from "@/components/charts/maintenance-frequency-chart";
import { OdometerChart } from "@/components/charts/odometer-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Fuel, Route, Wallet, Wrench } from "lucide-react";

function StatsFallback({ title }: { title: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        {title} failed to load.{" "}
        <button
          onClick={() => window.location.reload()}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Reload to try again
        </button>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const bike = useQuery(api.bike.getBike);
  const maintenanceStats = useQuery(api.maintenance.getMaintenanceStats);
  const expenseStats = useQuery(api.expenses.getExpenseStats);
  const fuelStats = useQuery(api.fuel.getFuelStats);
  const rideStats = useQuery(api.rides.getRideStats);

  useEffect(() => {
    if (bike === null) {
      router.replace("/setup");
    }
  }, [bike, router]);

  const statsLoading =
    maintenanceStats === undefined ||
    expenseStats === undefined ||
    fuelStats === undefined ||
    rideStats === undefined;

  const totalSpent = statsLoading
    ? 0
    : maintenanceStats.totalCost + expenseStats.totalAmount + fuelStats.totalCost;

  if (bike === undefined || bike === null) {
    return (
      <main className="flex flex-col p-4 md:p-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <PageHeader
          title="Analytics"
          description={`Visual insights for your ${bike.name}`}
        />

        {/* Key numbers */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
            ))
          ) : (
            <>
              <StatCard
                title="Total Spent"
                value={`₱${totalSpent.toLocaleString()}`}
                description="Maintenance, fuel & expenses"
                icon={<Wallet className="h-4 w-4" />}
              />
              <StatCard
                title="Fuel Efficiency"
                value={
                  fuelStats.avgKmPerLiter > 0
                    ? `${fuelStats.avgKmPerLiter.toFixed(1)} km/L`
                    : "—"
                }
                description={`${fuelStats.logCount} fuel-up${fuelStats.logCount === 1 ? "" : "s"}`}
                icon={<Fuel className="h-4 w-4" />}
              />
              <StatCard
                title="Total Distance"
                value={`${rideStats.totalDistance.toLocaleString()} km`}
                description={`${rideStats.totalRides} ride${rideStats.totalRides === 1 ? "" : "s"} logged`}
                icon={<Route className="h-4 w-4" />}
              />
              <StatCard
                title="Services Done"
                value={`${maintenanceStats.logCount}`}
                description={`₱${maintenanceStats.totalCost.toLocaleString()} in parts & labor`}
                icon={<Wrench className="h-4 w-4" />}
              />
            </>
          )}
        </div>

        {/* Trends */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ErrorBoundary fallback={<StatsFallback title="Monthly costs" />}>
            <CostChart />
          </ErrorBoundary>
          <ErrorBoundary fallback={<StatsFallback title="Fuel efficiency" />}>
            <FuelEfficiencyChart />
          </ErrorBoundary>
          <ErrorBoundary fallback={<StatsFallback title="Odometer progression" />}>
            <OdometerChart />
          </ErrorBoundary>
          <ErrorBoundary fallback={<StatsFallback title="Services by category" />}>
            <MaintenanceFrequencyChart />
          </ErrorBoundary>
        </div>
      </div>
    </main>
  );
}
