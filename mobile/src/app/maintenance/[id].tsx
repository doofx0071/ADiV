import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Trash2, Wrench } from "lucide-react-native";
import { api, type Id } from "@/lib/api";
import { AppButton, Card, EmptyState, LoadingState, Page } from "@/components/ui";
import { useAppTheme } from "@/lib/theme";
import { dateLabel, km, php } from "@/lib/format";

export default function MaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id as Id<"maintenanceItems">;
  const items = useQuery(api.maintenance.getMaintenanceItems);
  const logs = useQuery(api.maintenance.getMaintenanceLogs, { itemId, limit: 100 });
  const hasLogs = useQuery(api.maintenance.hasMaintenanceLogs, { itemId });
  const deleteItem = useMutation(api.maintenance.deleteMaintenanceItem);
  const deleteLog = useMutation(api.maintenance.deleteMaintenanceLog);
  const { colors } = useAppTheme();
  const item = items?.find((candidate) => candidate._id === itemId);

  if (items === undefined || logs === undefined || hasLogs === undefined) return <Page back><LoadingState /></Page>;
  if (!item) return <Page back title="Schedule item"><EmptyState title="Schedule item not found" body="It may have been removed from another device." /></Page>;

  function confirmDeleteItem() {
    Alert.alert("Delete schedule item?", "The item can be deleted only when it has no service history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteItem({ itemId }).then(() => router.back()).catch((error) => Alert.alert("Could not delete", error instanceof Error ? error.message : "Please try again.")) },
    ]);
  }
  function confirmDeleteLog(logId: Id<"maintenanceLogs">) {
    Alert.alert("Delete service record?", "This removes the service entry and its attached photos.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteLog({ logId }).catch((error) => Alert.alert("Could not delete", error instanceof Error ? error.message : "Please try again.")) },
    ]);
  }

  return (
    <Page back eyebrow={item.category} title={item.name} subtitle={item.description || "Maintenance schedule and completed service records."}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Wrench size={19} color={colors.primary} /><Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "900" }}>Schedule</Text></View>
        <Text style={{ color: colors.foreground, fontSize: 14 }}>Every {item.intervalKm ? `${item.intervalKm.toLocaleString()} km` : "—"} · {item.intervalMonths ? `${item.intervalMonths} months` : "—"}</Text>
        {item.serviceLevel ? <Text style={{ color: colors.mutedForeground }}>Service level: {item.serviceLevel}</Text> : null}
        {item.intervalSource ? <Text style={{ color: colors.mutedForeground, lineHeight: 19 }}>Interval source: {item.intervalSource}</Text> : <Text style={{ color: colors.warning, fontSize: 13 }}>No source note is recorded for these intervals.</Text>}
        {item.notes ? <Text style={{ color: colors.foreground, lineHeight: 19 }}>{item.notes}</Text> : null}
        <AppButton label="Edit schedule" onPress={() => router.push({ pathname: "/maintenance/edit", params: { itemId } })} variant="outline" icon={<Pencil size={16} color={colors.primary} />} />
      </Card>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "900" }}>Service history</Text>
          <Pressable onPress={() => router.push({ pathname: "/log/[type]", params: { type: "maintenance", itemId, mode: "history" } })} style={{ flexDirection: "row", gap: 5, alignItems: "center" }}><Plus size={16} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: "800" }}>Add known history</Text></Pressable>
        </View>
        {logs.length === 0 ? <EmptyState title="No service records yet" body="Log a completed service to establish this item's maintenance baseline." action={<AppButton label="Log service" onPress={() => router.push({ pathname: "/log/[type]", params: { type: "maintenance", itemId } })} />} /> : logs.map((log) => (
          <Card key={log._id}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "900" }}>{dateLabel(log.date)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Delete service record" onPress={() => confirmDeleteLog(log._id)}><Trash2 size={17} color={colors.danger} /></Pressable>
            </View>
            <Text style={{ color: colors.mutedForeground }}>{km(log.odometer)}{log.cost !== undefined ? ` · ${php(log.cost)}` : ""}</Text>
            {log.notes ? <Text style={{ color: colors.foreground, lineHeight: 19 }}>{log.notes}</Text> : null}
            {log.nextDueOdometer || log.nextDueDate ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Next due: {log.nextDueOdometer ? km(log.nextDueOdometer) : ""}{log.nextDueDate ? ` · ${dateLabel(log.nextDueDate)}` : ""}</Text> : null}
          </Card>
        ))}
      </View>
      {!hasLogs ? <AppButton label="Delete schedule item" onPress={confirmDeleteItem} variant="danger" /> : <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center" }}>This schedule has service history, so it cannot be deleted while records remain.</Text>}
    </Page>
  );
}
