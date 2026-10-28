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
import { AreaChart } from "@tremor/react";
import { Gauge } from "lucide-react";

export function OdometerChart() {
  const rides = useQuery(api.rides.getRides, { limit: 100 });

  const isLoading = rides === undefined;

  const data = useMemo(() => {
    if (!rides || rides.length === 0) return [];

    // Sort by date ascending
    const sorted = [...rides].sort((a, b) => a.date - b.date);

    return sorted.map((ride) => ({
      date: new Date(ride.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      odometer: ride.endOdometer,
    }));
  }, [rides]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Odometer Progression</CardTitle>
        <CardDescription>Recorded odometer at each ride</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeletonBody />
        ) : data.length > 0 ? (
          <AreaChart
            className="h-64"
            data={data}
            index="date"
            categories={["odometer"]}
            colors={["emerald"]}
            yAxisWidth={80}
            valueFormatter={(value) => `${value.toLocaleString()} km`}
            showLegend={false}
          />
        ) : (
          <ChartEmptyState
            icon={<Gauge />}
            title="No rides logged yet"
            description="Record your rides to watch the odometer climb over time."
            ctaLabel="Log a ride"
          />
        )}
      </CardContent>
    </Card>
  );
}
