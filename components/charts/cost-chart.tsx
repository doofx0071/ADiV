"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart } from "@tremor/react";
import { format, startOfMonth, subMonths } from "date-fns";

export function CostChart() {
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 1000 });
  const expenses = useQuery(api.expenses.getExpenses, { limit: 1000 });

  const data = useMemo(() => {
    if (!maintenanceLogs && !expenses) return [];

    const months: Record<string, { month: string; maintenance: number; expenses: number; total: number }> = {};

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const key = format(date, "yyyy-MM");
      const label = format(date, "MMM yyyy");
      months[key] = { month: label, maintenance: 0, expenses: 0, total: 0 };
    }

    // Add maintenance costs
    maintenanceLogs?.forEach((log) => {
      if (log.cost && log.cost > 0) {
        const key = format(new Date(log.date), "yyyy-MM");
        if (months[key]) {
          months[key].maintenance += log.cost;
          months[key].total += log.cost;
        }
      }
    });

    // Add expenses
    expenses?.forEach((expense) => {
      const key = format(new Date(expense.date), "yyyy-MM");
      if (months[key]) {
        months[key].expenses += expense.amount;
        months[key].total += expense.amount;
      }
    });

    return Object.values(months);
  }, [maintenanceLogs, expenses]);

  const hasData = data.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Costs</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
          No cost data yet — log maintenance and expenses to see trends
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Monthly Costs</CardTitle>
      </CardHeader>
      <CardContent>
        <AreaChart
          className="h-64"
          data={data}
          index="month"
          categories={["maintenance", "expenses"]}
          colors={["cyan", "orange"]}
          yAxisWidth={60}
          valueFormatter={(value) => `₱${value.toLocaleString()}`}
          showLegend
        />
      </CardContent>
    </Card>
  );
}
