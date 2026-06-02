"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export default function ExportPage() {
  const [isExporting, setIsExporting] = useState(false);
  const bike = useQuery(api.bike.getBike);
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 1000 });
  const rides = useQuery(api.rides.getRides, { limit: 1000 });
  const fuelLogs = useQuery(api.fuel.getFuelLogs, { limit: 1000 });
  const expenses = useQuery(api.expenses.getExpenses, { limit: 1000 });
  const achievements = useQuery(api.achievements.getAchievements);

  const isLoading =
    bike === undefined ||
    maintenanceItems === undefined ||
    maintenanceLogs === undefined ||
    rides === undefined ||
    fuelLogs === undefined ||
    expenses === undefined ||
    achievements === undefined;

  const exportData = {
    exportedAt: new Date().toISOString(),
    bike,
    maintenanceItems,
    maintenanceLogs,
    rides,
    fuelLogs,
    expenses,
    achievements,
  };

  const downloadJSON = () => {
    setIsExporting(true);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adiv-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("JSON export downloaded!");
    setIsExporting(false);
  };

  const downloadCSV = () => {
    setIsExporting(true);
    // Simple CSV export for maintenance logs
    const headers = ["Type", "Date", "Odometer", "Cost", "Notes"];
    const rows: (string | number)[][] = [
      ...(maintenanceLogs?.map((log) => [
        "Maintenance",
        new Date(log.date).toISOString().split("T")[0],
        log.odometer,
        log.cost ?? 0,
        log.notes ?? "",
      ]) ?? []),
      ...(rides?.map((ride) => [
        "Ride",
        new Date(ride.date).toISOString().split("T")[0],
        ride.endOdometer,
        0,
        `${ride.distance}km in ${ride.durationMinutes}min`,
      ]) ?? []),
      ...(fuelLogs?.map((log) => [
        "Fuel",
        new Date(log.date).toISOString().split("T")[0],
        log.odometer,
        log.totalPrice,
        `${log.liters}L @ ₱${log.pricePerLiter}/L`,
      ]) ?? []),
      ...(expenses?.map((expense) => [
        "Expense",
        new Date(expense.date).toISOString().split("T")[0],
        0,
        expense.amount,
        expense.description ?? expense.category,
      ]) ?? []),
    ];

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adiv-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV export downloaded!");
    setIsExporting(false);
  };

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <PageHeader title="Data Export" description="Download your motorcycle data" />

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">JSON Export</h3>
              <p className="text-sm text-muted-foreground">
                Complete data backup in JSON format. Includes bike profile, logs, and achievements.
              </p>
              <Button
                onClick={downloadJSON}
                disabled={isLoading || isExporting}
                className="gap-2"
              >
                <FileJson className="h-4 w-4" />
                Download JSON
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">CSV Export</h3>
              <p className="text-sm text-muted-foreground">
                Spreadsheet-friendly format for logs and expenses.
              </p>
              <Button
                onClick={downloadCSV}
                disabled={isLoading || isExporting}
                variant="secondary"
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
