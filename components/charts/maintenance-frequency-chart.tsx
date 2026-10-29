"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartEmptyState, ChartSkeletonBody } from "@/components/charts/chart-states";
import { BarChart } from "@tremor/react";
import { Wrench } from "lucide-react";
import { AnalyticsTooltip } from "@/components/charts/analytics-tooltip";

export function MaintenanceFrequencyChart() {
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 1000 });

  const isLoading = maintenanceItems === undefined || maintenanceLogs === undefined;

  const data = useMemo(() => {
    if (!maintenanceItems || !maintenanceLogs) return [];

    // Build a map of itemId -> category
    const itemCategories = new Map<string, string>();
    maintenanceItems.forEach((item) => {
      itemCategories.set(item._id, item.category);
    });

    // Count services per category
    const categoryCounts: Record<string, number> = {};
    maintenanceLogs.forEach((log) => {
      const category = itemCategories.get(log.itemId) ?? "Unknown";
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    });

    return Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      services: count,
    }));
  }, [maintenanceItems, maintenanceLogs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Services by Category</CardTitle>
        <CardDescription>Which maintenance areas you service most</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeletonBody />
        ) : data.length > 0 ? (
          <BarChart
            className="h-64 w-full"
            data={data}
            index="category"
            categories={["services"]}
            colors={["red"]}
            yAxisWidth={40}
            showLegend={false}
            showAnimation={false}
            customTooltip={AnalyticsTooltip}
          />
        ) : (
          <ChartEmptyState
            icon={<Wrench />}
            title="No maintenance logged yet"
            description="Service history will show which areas of your bike need the most attention."
            ctaLabel="Log maintenance"
          />
        )}
      </CardContent>
    </Card>
  );
}
