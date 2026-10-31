import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { router } from "expo-router";
import { Plus, Wrench } from "lucide-react-native";
import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { AppButton, Banner, Card, ChoiceRow, EmptyState, LoadingState, Page, colorsForStatus } from "@/components/ui";
import { evaluateMaintenanceItems, summarizeMaintenanceEvaluations } from "@/lib/shared";
import { km, dateLabel } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";

type Filter = "all" | "overdue" | "due" | "upcoming" | "needs-history" | "clear";
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" }, { value: "overdue", label: "Overdue" }, { value: "due", label: "Due" },
  { value: "upcoming", label: "Upcoming" }, { value: "needs-history", label: "Needs history" }, { value: "clear", label: "Clear" },
];

export default function MaintenanceScreen() {
  const bike = useQuery(api.bike.getBike);
  const items = useQuery(api.maintenance.getMaintenanceItems);
  const [filter, setFilter] = useState<Filter>("all");
  const { colors } = useAppTheme();
  const evaluations = useMemo(() => bike && items ? evaluateMaintenanceItems(items, bike.currentOdometer, new Date()) : [], [bike, items]);
  const summary = useMemo(() => summarizeMaintenanceEvaluations(evaluations), [evaluations]);

  if (bike === undefined || items === undefined) return <Page><LoadingState /></Page>;

  const shown = filter === "all" ? evaluations : evaluations.filter((evaluation) => evaluation.status === filter);
  return (
    <Page eyebrow="Service schedule" title="Maintenance" subtitle="Editable intervals with clear service-history status."
      right={<Pressable accessibilityRole="button" accessibilityLabel="Add maintenance item" onPress={() => router.push("/maintenance/edit")} style={{ width: 42, height: 42, borderRadius: 0, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}><Plus size={21} color="#fff" /></Pressable>}>
      {!bike ? <EmptyState title="Set up your ADV160" body="Create your bike profile to start using maintenance reminders." action={<AppButton label="Set up bike" onPress={() => router.push("/setup")} />} /> : null}
      {bike && summary.needsHistory > 0 ? <Banner title={`${summary.needsHistory} ${summary.needsHistory === 1 ? "item needs" : "items need"} confirmed history`} body="Enter a known service date and odometer in the item details. Unknown baselines stay unknown." /> : null}
      {bike ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
            <Text style={{ color: colors.foreground, fontWeight: "900" }}>Readiness</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{km(bike.currentOdometer)} · {summary.total} items</Text>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{summary.overdue} overdue · {summary.due} due soon · {summary.upcoming} upcoming · {summary.clear} clear</Text>
        </Card>
      ) : null}
      <ChoiceRow value={filter} options={filters} onChange={setFilter} />
      {shown.map(({ item, status, dueAtOdometer, dueAtDate, dueInKm, dueInDays, missingBaseline }) => (
        <Pressable key={item._id} onPress={() => router.push({ pathname: "/maintenance/[id]", params: { id: item._id } })}>
          <Card style={{ gap: 11 }}>
            <View style={{ flexDirection: "row", gap: 11, alignItems: "center" }}>
              <View style={{ width: 42, height: 42, borderRadius: 0, backgroundColor: `${colorsForStatus(colors, status)}18`, alignItems: "center", justifyContent: "center" }}><Wrench size={19} color={colorsForStatus(colors, status)} /></View>
              <View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "900" }}>{item.name}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12, textTransform: "capitalize", marginTop: 2 }}>{item.category}{item.serviceLevel ? ` · ${item.serviceLevel}` : ""}</Text></View>
              <Text style={{ color: colorsForStatus(colors, status), fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>{status.replace("-", " ")}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ gap: 4 }}>
              {item.intervalKm ? <Text style={{ color: colors.foreground, fontSize: 13 }}>Distance: {dueAtOdometer ? km(dueAtOdometer) : "baseline needed"}{dueInKm !== null ? ` · ${dueInKm < 0 ? `${km(Math.abs(dueInKm))} overdue` : `${km(dueInKm)} left`}` : ""}</Text> : null}
              {item.intervalMonths ? <Text style={{ color: colors.foreground, fontSize: 13 }}>Time: {dueAtDate ? dateLabel(dueAtDate.getTime()) : "baseline needed"}{dueInDays !== null ? ` · ${dueInDays < 0 ? `${Math.abs(dueInDays)} days overdue` : `${dueInDays} days left`}` : ""}</Text> : null}
              {missingBaseline.length > 0 ? <Text style={{ color: colors.warning, fontSize: 12 }}>Needs confirmed {missingBaseline.map((b) => b === "service-date" ? "date" : "odometer").join(" and ")}</Text> : null}
              {item.intervalSource ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={2}>Source: {item.intervalSource}</Text> : null}
              {!item.intervalKm && !item.intervalMonths ? <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>No interval is set.</Text> : null}
            </View>
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>View schedule and service history →</Text>
          </Card>
        </Pressable>
      ))}
      {shown.length === 0 && items.length > 0 ? <EmptyState title="No items in this filter" body="Choose another status to view the rest of your maintenance schedule." /> : null}
      {items.length === 0 && bike ? <EmptyState title="Your schedule is empty" body="Add a schedule item and set its km interval, month interval, or both." action={<AppButton label="Add schedule item" onPress={() => router.push("/maintenance/edit")} />} /> : null}
    </Page>
  );
}
