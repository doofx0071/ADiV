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
import { LineChart } from "@tremor/react";
import { Fuel } from "lucide-react";
import { AnalyticsTooltip } from "@/components/charts/analytics-tooltip";

export function FuelEfficiencyChart() {
  const fuelLogs = useQuery(api.fuel.getFuelLogs, { limit: 100 });

  const isLoading = fuelLogs === undefined;

  const data = useMemo(() => {
    if (!fuelLogs || fuelLogs.length < 2) return [];

    // Sort by date ascending for consecutive calculation
    const sorted = [...fuelLogs].sort((a, b) => a.date - b.date);
    const points = [];

    for (let i = 1; i < sorted.length; i++) {
      const distance = sorted[i].odometer - sorted[i - 1].odometer;
      if (distance > 0 && sorted[i].liters > 0) {
        const kmPerLiter = distance / sorted[i].liters;
        points.push({
          date: new Date(sorted[i].date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          efficiency: Number(kmPerLiter.toFixed(1)),
        });
      }
    }

    // Return last 10 fuel-ups
    return points.slice(-10);
  }, [fuelLogs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Fuel Efficiency Trend</CardTitle>
        <CardDescription>km per liter across your last fuel-ups</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeletonBody />
        ) : data.length > 0 ? (
          <LineChart
            className="h-64"
            data={data}
            index="date"
            categories={["efficiency"]}
            colors={["red"]}
            yAxisWidth={60}
            valueFormatter={(value) => `${value} km/L`}
            showLegend={false}
            showAnimation={false}
            customTooltip={AnalyticsTooltip}
          />
        ) : (
          <ChartEmptyState
            icon={<Fuel />}
            title="Not enough fuel-ups yet"
            description="Log at least two fuel-ups and your efficiency trend will appear here."
            ctaLabel="Log a fuel-up"
          />
        )}
      </CardContent>
    </Card>
  );
}
