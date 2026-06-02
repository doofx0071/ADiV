"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { CostChart } from "@/components/charts/cost-chart";
import { FuelEfficiencyChart } from "@/components/charts/fuel-efficiency-chart";
import { MaintenanceFrequencyChart } from "@/components/charts/maintenance-frequency-chart";
import { OdometerChart } from "@/components/charts/odometer-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Fuel, Wrench, Gauge } from "lucide-react";

export default function AnalyticsPage() {
  const bike = useQuery(api.bike.getBike);

  if (bike === undefined) {
    return (
      <main className="flex min-h-screen flex-col p-4 md:p-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <PageHeader
          title="Analytics"
          description={`Visual insights for your ${bike?.name ?? "motorcycle"}`}
        />

        <Tabs defaultValue="costs" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="costs" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Costs
            </TabsTrigger>
            <TabsTrigger value="fuel" className="gap-1.5">
              <Fuel className="h-4 w-4" />
              Fuel
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-1.5">
              <Wrench className="h-4 w-4" />
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="odometer" className="gap-1.5">
              <Gauge className="h-4 w-4" />
              Odometer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="costs" className="mt-0">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CostChart />
            </div>
          </TabsContent>

          <TabsContent value="fuel" className="mt-0">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FuelEfficiencyChart />
            </div>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-0">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <MaintenanceFrequencyChart />
            </div>
          </TabsContent>

          <TabsContent value="odometer" className="mt-0">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <OdometerChart />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
