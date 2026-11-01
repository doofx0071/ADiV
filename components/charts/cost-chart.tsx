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
import { format, subMonths } from "date-fns";
import { Wallet } from "lucide-react";
import { AnalyticsTooltip } from "@/components/charts/analytics-tooltip";

export function CostChart() {
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 1000 });
  const expenses = useQuery(api.expenses.getExpenses, { limit: 1000 });
  const fuelLogs = useQuery(api.fuel.getFuelLogs, { limit: 1000 });

  const isLoading =
    maintenanceLogs === undefined || expenses === undefined || fuelLogs === undefined;

  const data = useMemo(() => {
    if (!maintenanceLogs || !expenses || !fuelLogs) return [];

    const months: Record<
      string,
      { month: string; maintenance: number; expenses: number; fuel: number }
    > = {};

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const key = format(date, "yyyy-MM");
      const label = format(date, "MMM yyyy");
      months[key] = { month: label, maintenance: 0, expenses: 0, fuel: 0 };
    }

    // Add maintenance costs
    maintenanceLogs.forEach((log) => {
      if (log.cost && log.cost > 0) {
        const key = format(new Date(log.date), "yyyy-MM");
        if (months[key]) {
          months[key].maintenance += log.cost;
        }
      }
    });

    // Add expenses
    expenses.forEach((expense) => {
      const key = format(new Date(expense.date), "yyyy-MM");
      if (months[key]) {
        months[key].expenses += expense.amount;
      }
    });

    // Add fuel spend (fuel-ups were missing from this chart before)
    fuelLogs.forEach((log) => {
      const key = format(new Date(log.date), "yyyy-MM");
      if (months[key]) {
        months[key].fuel += log.totalPrice;
      }
    });

    return Object.values(months);
  }, [maintenanceLogs, expenses, fuelLogs]);

  const hasData = data.some(
    (d) => d.maintenance > 0 || d.expenses > 0 || d.fuel > 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Monthly Costs</CardTitle>
        <CardDescription>
          Maintenance, fuel, and expenses — last 12 months
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeletonBody />
        ) : hasData ? (
          <AreaChart
            className="h-64 w-full"
            data={data}
            index="month"
            categories={["maintenance", "fuel", "expenses"]}
            colors={["red", "amber", "emerald"]}
            yAxisWidth={60}
            valueFormatter={(value) => `₱${value.toLocaleString()}`}
            showLegend
            showAnimation={false}
            showGridLines
            startEndOnly
            customTooltip={(props) => (
              <AnalyticsTooltip {...props} formatValue={(value) => `₱${Number(value).toLocaleString()}`} />
            )}
          />
        ) : (
          <ChartEmptyState
            icon={<Wallet />}
            title="No cost data yet"
            description="Log maintenance work, fuel-ups, or expenses to see your monthly spending trends."
            ctaLabel="Log an entry"
          />
        )}
      </CardContent>
    </Card>
  );
}
