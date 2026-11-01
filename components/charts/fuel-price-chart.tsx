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
import { TrendingUp } from "lucide-react";
import { AnalyticsTooltip } from "@/components/charts/analytics-tooltip";

/**
 * Fuel price per liter over time, per refuel, with the all-time average for
 * reference (is today's price above or below what you usually pay?).
 */
export function FuelPriceChart() {
  const insights = useQuery(api.fuel.getFuelInsights);

  const isLoading = insights === undefined;

  const data =
    insights?.priceSeries.slice(-20).map((point) => ({
      date: new Date(point.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      price: Number(point.pricePerLiter.toFixed(2)),
    })) ?? [];

  const latest = insights?.latestPricePerLiter ?? 0;
  const average = insights?.avgPricePerLiter ?? 0;
  const delta = latest - average;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Fuel Price per Liter</CardTitle>
        <CardDescription>
          {insights && insights.refuelCount > 0
            ? `Latest ₱${latest.toFixed(2)} · average ₱${average.toFixed(2)} (${delta >= 0 ? "+" : "−"}₱${Math.abs(delta).toFixed(2)})`
            : "Price per liter at each refuel"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeletonBody />
        ) : data.length > 0 ? (
          <LineChart
            className="h-64"
            data={data}
            index="date"
            categories={["price"]}
            colors={["amber"]}
            yAxisWidth={60}
            valueFormatter={(value) => `₱${Number(value).toFixed(2)}`}
            showLegend={false}
            showAnimation={false}
            customTooltip={(props) => (
              <AnalyticsTooltip
                {...props}
                formatValue={(value) => `₱${Number(value).toFixed(2)}`}
              />
            )}
          />
        ) : (
          <ChartEmptyState
            icon={<TrendingUp />}
            title="No fuel prices yet"
            description="Log a fuel-up to start tracking price per liter over time."
            ctaLabel="Log a fuel-up"
          />
        )}
      </CardContent>
    </Card>
  );
}
