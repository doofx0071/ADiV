import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Trash2 } from "lucide-react-native";
import { api, type Id } from "@/lib/api";
import { AppButton, Card, ChoiceRow, EmptyState, LoadingState, Page } from "@/components/ui";
import { dateLabel, km, php, rideTimeLabel } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";

type EntryType = "ride" | "fuel" | "maintenance" | "expense";
type Filter = "all" | EntryType;
interface Entry { id: string; type: EntryType; title: string; date: number; detail: string; notes?: string }
const options: { value: Filter; label: string }[] = [
  { value: "all", label: "All" }, { value: "ride", label: "Rides" }, { value: "fuel", label: "Fuel" },
  { value: "maintenance", label: "Service" }, { value: "expense", label: "Expenses" },
];

export default function HistoryScreen() {
  const rides = useQuery(api.rides.getRides, { limit: 1000 });
  const fuelLogs = useQuery(api.fuel.getFuelLogs, { limit: 1000 });
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 1000 });
  const expenses = useQuery(api.expenses.getExpenses, { limit: 1000 });
  const deleteRide = useMutation(api.rides.deleteRide);
  const deleteFuel = useMutation(api.fuel.deleteFuelLog);
  const deleteMaintenance = useMutation(api.maintenance.deleteMaintenanceLog);
  const deleteExpense = useMutation(api.expenses.deleteExpense);
  const [filter, setFilter] = useState<Filter>("all");
  const { colors } = useAppTheme();

  const entries = useMemo(() => {
    if (!rides || !fuelLogs || !maintenanceLogs || !expenses) return [];
    const all: Entry[] = [
      ...rides.map((row) => ({ id: row._id, type: "ride" as const, title: "Ride", date: row.date, detail: `${km(row.distance)} · ${rideTimeLabel(row.startAt, row.endAt, row.durationMinutes)}`, notes: row.notes })),
      ...fuelLogs.map((row) => ({ id: row._id, type: "fuel" as const, title: "Fuel-up", date: row.date, detail: `${row.liters.toFixed(2)} L · ${php(row.totalPrice)} · ${km(row.odometer)}`, notes: [row.stationName, row.notes].filter(Boolean).join(" · ") || undefined })),
      ...maintenanceLogs.map((row) => ({ id: row._id, type: "maintenance" as const, title: row.itemName ?? "Maintenance", date: row.date, detail: `${km(row.odometer)}${row.cost !== undefined ? ` · ${php(row.cost)}` : ""}`, notes: row.notes })),
      ...expenses.map((row) => ({ id: row._id, type: "expense" as const, title: row.category, date: row.date, detail: php(row.amount), notes: row.description })),
    ];
    return all.sort((a, b) => b.date - a.date);
  }, [rides, fuelLogs, maintenanceLogs, expenses]);

  const loading = rides === undefined || fuelLogs === undefined || maintenanceLogs === undefined || expenses === undefined;
  if (loading) return <Page><LoadingState /></Page>;
  const shown = filter === "all" ? entries : entries.filter((entry) => entry.type === filter);

  function confirmDelete(entry: Entry) {
    Alert.alert("Delete this log?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        const request = entry.type === "ride" ? deleteRide({ rideId: entry.id as Id<"rides"> })
          : entry.type === "fuel" ? deleteFuel({ fuelLogId: entry.id as Id<"fuelLogs"> })
          : entry.type === "maintenance" ? deleteMaintenance({ logId: entry.id as Id<"maintenanceLogs"> })
          : deleteExpense({ expenseId: entry.id as Id<"expenses"> });
        void request.catch((error) => Alert.alert("Could not delete", error instanceof Error ? error.message : "Please try again."));
      } },
    ]);
  }

  return (
    <Page eyebrow="Your records" title="History" subtitle="Review and edit each log within the fields the web app allows.">
      <ChoiceRow value={filter} options={options} onChange={setFilter} />
      {shown.map((entry) => (
        <Card key={`${entry.type}-${entry.id}`}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 16 }}>{entry.title}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{dateLabel(entry.date)} · {entry.type}</Text>
              <Text style={{ color: colors.foreground, fontSize: 14 }}>{entry.detail}</Text>
              {entry.notes ? <Text style={{ color: colors.mutedForeground, fontSize: 13 }} numberOfLines={2}>{entry.notes}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${entry.title}`} onPress={() => router.push({ pathname: "/history/edit", params: { type: entry.type, id: entry.id } })} style={{ padding: 7 }}><Pencil size={18} color={colors.primary} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${entry.title}`} onPress={() => confirmDelete(entry)} style={{ padding: 7 }}><Trash2 size={18} color={colors.danger} /></Pressable>
          </View>
        </Card>
      ))}
      {shown.length === 0 ? <EmptyState title="No logs yet" body="Add your first ride, fuel-up, service, or expense from the home screen." action={<AppButton label="Log a ride" onPress={() => router.push({ pathname: "/log/[type]", params: { type: "ride" } })} />} /> : null}
    </Page>
  );
}
