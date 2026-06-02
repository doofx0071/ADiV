"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@tremor/react";

export function MaintenanceFrequencyChart() {
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 1000 });

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

  const hasData = data.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Services by Category</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
          No maintenance logs yet — service your bike to see breakdowns
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Services by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <BarChart
          className="h-64"
          data={data}
          index="category"
          categories={["services"]}
          colors={["orange"]}
          yAxisWidth={40}
          showLegend={false}
        />
      </CardContent>
    </Card>
  );
}
