"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart } from "@tremor/react";

export function OdometerChart() {
  const rides = useQuery(api.rides.getRides, { limit: 100 });

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

  const hasData = data.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Odometer Progression</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
          No rides logged yet — record rides to track odometer progression
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Odometer Progression</CardTitle>
      </CardHeader>
      <CardContent>
        <AreaChart
          className="h-64"
          data={data}
          index="date"
          categories={["odometer"]}
          colors={["cyan"]}
          yAxisWidth={80}
          valueFormatter={(value) => `${value.toLocaleString()} km`}
          showLegend={false}
        />
      </CardContent>
    </Card>
  );
}
