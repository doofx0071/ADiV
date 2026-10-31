import { useState } from "react";
import { AppText as Text } from "@/components/app-text";
import { useQuery } from "convex/react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "@/lib/api";
import { AppButton, Card, LoadingState, Page } from "@/components/ui";
import { useAppTheme } from "@/lib/theme";

type ExportKind = "json" | "rides" | "fuel" | "maintenance" | "expenses";

function csvCell(value: unknown) {
  const stringValue = value === undefined || value === null ? "" : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export default function ExportScreen() {
  const bike = useQuery(api.bike.getBike);
  const items = useQuery(api.maintenance.getMaintenanceItems);
  const rides = useQuery(api.rides.getRides, { limit: 10000 });
  const fuelLogs = useQuery(api.fuel.getFuelLogs, { limit: 10000 });
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 10000 });
  const expenses = useQuery(api.expenses.getExpenses, { limit: 10000 });
  const achievements = useQuery(api.achievements.getAchievements);
  const [sharing, setSharing] = useState<ExportKind | null>(null);
  const [error, setError] = useState("");
  const { colors } = useAppTheme();
  const loading = bike === undefined || items === undefined || rides === undefined || fuelLogs === undefined || maintenanceLogs === undefined || expenses === undefined || achievements === undefined;

  async function exportFile(kind: ExportKind) {
    if (loading) return;
    setSharing(kind);
    setError("");
    try {
      let filename: string;
      let content: string;
      let mimeType: string;
      if (kind === "json") {
        filename = `adiv-backup-${Date.now()}.json`;
        mimeType = "application/json";
        content = JSON.stringify({ exportedAt: new Date().toISOString(), bike, maintenanceItems: items, rides, fuelLogs, maintenanceLogs, expenses, achievements }, null, 2);
      } else {
        const tables = {
          rides: { filename: "adiv-rides", headers: ["date", "startOdometerKm", "endOdometerKm", "distanceKm", "durationMinutes", "notes"], rows: rides.map((row) => [row.date, row.startOdometer, row.endOdometer, row.distance, row.durationMinutes, row.notes]) },
          fuel: { filename: "adiv-fuel", headers: ["date", "odometerKm", "liters", "pricePerLiterPHP", "totalPricePHP", "stationName", "notes"], rows: fuelLogs.map((row) => [row.date, row.odometer, row.liters, row.pricePerLiter, row.totalPrice, row.stationName, row.notes]) },
          maintenance: { filename: "adiv-maintenance", headers: ["date", "item", "odometerKm", "costPHP", "notes", "photoStorageIds"], rows: maintenanceLogs.map((row) => [row.date, row.itemName, row.odometer, row.cost, row.notes, row.photos?.join(";")]) },
          expenses: { filename: "adiv-expenses", headers: ["date", "category", "amountPHP", "description"], rows: expenses.map((row) => [row.date, row.category, row.amount, row.description]) },
        };
        const table = tables[kind];
        filename = `${table.filename}-${Date.now()}.csv`;
        mimeType = "text/csv";
        content = [table.headers.map(csvCell).join(","), ...table.rows.map((row) => row.map(csvCell).join(","))].join("\r\n");
      }

      const file = new File(Paths.cache, filename);
      file.create({ intermediates: true, overwrite: true });
      await file.write(content);
      if (!await Sharing.isAvailableAsync()) throw new Error("File sharing is not available on this device.");
      await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: `Share AdiV ${kind === "json" ? "backup" : `${kind} CSV`}` });
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not create this export.");
    } finally { setSharing(null); }
  }

  return (
    <Page back eyebrow="Your data" title="Export records" subtitle="Create a local file, then share it with an app on your Android phone.">
      {loading ? <LoadingState label="Loading records for export…" /> : <>
        <Card>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "900" }}>Complete backup</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>JSON includes the bike profile, schedule, logs, and achievements for backup or migration.</Text>
          <AppButton label={sharing === "json" ? "Preparing backup…" : "Share JSON backup"} onPress={() => void exportFile("json")} busy={sharing === "json"} />
        </Card>
        <Card>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "900" }}>CSV spreadsheets</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>Export a separate CSV for each log type. Dates are stored in milliseconds since the Unix epoch, matching Convex records.</Text>
          <AppButton label={sharing === "rides" ? "Preparing rides…" : "Share rides CSV"} onPress={() => void exportFile("rides")} variant="outline" busy={sharing === "rides"} />
          <AppButton label={sharing === "fuel" ? "Preparing fuel…" : "Share fuel CSV"} onPress={() => void exportFile("fuel")} variant="outline" busy={sharing === "fuel"} />
          <AppButton label={sharing === "maintenance" ? "Preparing service…" : "Share maintenance CSV"} onPress={() => void exportFile("maintenance")} variant="outline" busy={sharing === "maintenance"} />
          <AppButton label={sharing === "expenses" ? "Preparing expenses…" : "Share expenses CSV"} onPress={() => void exportFile("expenses")} variant="outline" busy={sharing === "expenses"} />
        </Card>
        {error ? <Text style={{ color: colors.danger, fontSize: 13, lineHeight: 19 }}>{error}</Text> : null}
      </>}
    </Page>
  );
}
