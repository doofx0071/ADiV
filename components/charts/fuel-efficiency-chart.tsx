"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "@tremor/react";

export function FuelEfficiencyChart() {
  const fuelLogs = useQuery(api.fuel.getFuelLogs, { limit: 100 });

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

  const hasData = data.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fuel Efficiency Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
          Log at least 2 fuel-ups to see efficiency trends
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Fuel Efficiency Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <LineChart
          className="h-64"
          data={data}
          index="date"
          categories={["efficiency"]}
          colors={["red"]}
          yAxisWidth={60}
          valueFormatter={(value) => `${value} km/L`}
          showLegend={false}
        />
      </CardContent>
    </Card>
  );
}
