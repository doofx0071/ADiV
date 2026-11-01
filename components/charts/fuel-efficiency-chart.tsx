"use client";

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

/**
 * Per-refuel efficiency from the filled-to-full engine (lib/fuel-insights.ts):
 * only full→full windows count, so partial fills no longer distort the trend.
 */
export function FuelEfficiencyChart() {
  const insights = useQuery(api.fuel.getFuelInsights);

  const isLoading = insights === undefined;

  const data =
    insights?.validSegments.slice(-20).map((segment) => ({
      date: new Date(segment.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      efficiency: Number(segment.kmL.toFixed(1)),
    })) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Fuel Efficiency Trend</CardTitle>
        <CardDescription>
          km per liter per full-to-full refuel window
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeletonBody />
        ) : data.length > 0 ? (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted px-2 py-2">
                <p className="text-[11px] text-muted-foreground">Average</p>
                <p className="text-sm font-semibold">
                  {insights!.avgKmPerLiter.toFixed(1)} km/L
                </p>
              </div>
              <div className="rounded-lg bg-muted px-2 py-2">
                <p className="text-[11px] text-muted-foreground">Best</p>
                <p className="text-sm font-semibold">
                  {insights!.bestSegment ? `${insights!.bestSegment.kmL.toFixed(1)}` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-muted px-2 py-2">
                <p className="text-[11px] text-muted-foreground">Worst</p>
                <p className="text-sm font-semibold">
                  {insights!.worstSegment ? `${insights!.worstSegment.kmL.toFixed(1)}` : "—"}
                </p>
              </div>
            </div>
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
            {insights!.validSegments.length < 2 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Mark each refuel as &ldquo;filled to full&rdquo; (default) — only full-to-full
                windows measure real consumption.
              </p>
            )}
          </>
        ) : (
          <ChartEmptyState
            icon={<Fuel />}
            title="Not enough fuel-ups yet"
            description="Log two full-to-full refuels and your efficiency trend will appear here. Partial fills are skipped."
            ctaLabel="Log a fuel-up"
          />
        )}
      </CardContent>
    </Card>
  );
}
