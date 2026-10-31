import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { AppText as Text } from "@/components/app-text";
import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { Card, LoadingState, Page, SectionTitle, StatCard } from "@/components/ui";
import { dateStartMs, php, km } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";

function BarRow({ label, value, max, caption, color }: { label: string; value: number; max: number; caption: string; color: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700", flex: 1 }}>{label}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{caption}</Text></View>
      <View style={{ height: 8, borderRadius: 0, backgroundColor: colors.secondary, overflow: "hidden" }}><View style={{ height: 8, borderRadius: 0, width: `${max > 0 ? Math.max(3, (value / max) * 100) : 0}%`, backgroundColor: color }} /></View>
    </View>
  );
}

function SpendingTrend({ data, color, gridColor, mutedColor, total }: {
  data: { label: string; spend: number }[];
  color: string;
  gridColor: string;
  mutedColor: string;
  total: number;
}) {
  const width = 360;
  const height = 148;
  const left = 12;
  const right = width - 12;
  const top = 12;
  const bottom = height - 14;
  const max = Math.max(...data.map((entry) => entry.spend), 1);
  const points = data.map((entry, index) => {
    const x = left + (index * (right - left)) / Math.max(data.length - 1, 1);
    const y = bottom - (entry.spend / max) * (bottom - top);
    return { ...entry, x, y };
  });
  const pointString = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const hasSpending = data.some((entry) => entry.spend > 0);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Text style={{ color: mutedColor, fontSize: 12, flex: 1 }}>Fuel, service, and other expenses</Text>
        <Text style={{ color, fontSize: 14, fontWeight: "900" }}>{php(total)}</Text>
      </View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityRole="image" accessibilityLabel={`Six month spending trend: ${data.map((entry) => `${entry.label} ${php(entry.spend)}`).join(", ")}`}>
        {[0, 0.5, 1].map((ratio) => {
          const y = bottom - ratio * (bottom - top);
          return <Line key={ratio} x1={left} x2={right} y1={y} y2={y} stroke={gridColor} strokeWidth={1} strokeDasharray="4 5" />;
        })}
        <Polyline points={pointString} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="miter" strokeLinecap="square" />
        {points.map(({ label, x, y, spend }) => <Circle key={label} cx={x} cy={y} r={5} fill={color} stroke={gridColor} strokeWidth={2} accessibilityLabel={`${label}: ${php(spend)}`} />)}
      </Svg>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {data.map((entry) => (
          <View key={entry.label} style={{ flexBasis: "30%", flexGrow: 1, gap: 3 }}>
            <Text style={{ color: mutedColor, fontSize: 11, fontWeight: "700" }}>{entry.label}</Text>
            <Text style={{ color, fontSize: 12, fontWeight: "800" }}>{php(entry.spend)}</Text>
          </View>
        ))}
      </View>
      {!hasSpending ? <Text style={{ color: mutedColor, fontSize: 12 }}>No spending logs were recorded in these six months.</Text> : null}
    </View>
  );
}

export default function AnalyticsScreen() {
  const bike = useQuery(api.bike.getBike);
  const rideStats = useQuery(api.rides.getRideStats, {});
  const rides = useQuery(api.rides.getRides, { limit: 1000 });
  const fuelStats = useQuery(api.fuel.getFuelStats, {});
  const fuelLogs = useQuery(api.fuel.getFuelLogs, { limit: 1000 });
  const maintenanceStats = useQuery(api.maintenance.getMaintenanceStats, {});
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 1000 });
  const expenses = useQuery(api.expenses.getExpenses, { limit: 1000 });
  const expenseStats = useQuery(api.expenses.getExpenseStats, {});
  const items = useQuery(api.maintenance.getMaintenanceItems);
  const { colors } = useAppTheme();

  const monthly = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const start = dateStartMs(month);
      const end = dateStartMs(new Date(month.getFullYear(), month.getMonth() + 1, 1));
      const distance = (rides ?? []).filter((ride) => ride.date >= start && ride.date < end).reduce((sum, ride) => sum + ride.distance, 0);
      const expenseSpend = (expenses ?? []).filter((expense) => expense.date >= start && expense.date < end).reduce((sum, expense) => sum + expense.amount, 0);
      const fuelSpend = (fuelLogs ?? []).filter((log) => log.date >= start && log.date < end).reduce((sum, log) => sum + log.totalPrice, 0);
      const maintenanceSpend = (maintenanceLogs ?? []).filter((log) => log.date >= start && log.date < end).reduce((sum, log) => sum + (log.cost ?? 0), 0);
      const spend = expenseSpend + fuelSpend + maintenanceSpend;
      return { label: month.toLocaleDateString("en-PH", { month: "short" }), distance, spend };
    });
  }, [rides, expenses, fuelLogs, maintenanceLogs]);

  const expenseCategories = expenseStats?.byCategory ?? [];
  const maintCategories = useMemo(() => {
    const byCategory = new Map<string, number>();
    const itemCategories = new Map((items ?? []).map((item) => [item._id, item.category]));
    for (const log of maintenanceLogs ?? []) {
      const category = itemCategories.get(log.itemId) ?? "other";
      byCategory.set(category, (byCategory.get(category) ?? 0) + (log.cost ?? 0));
    }
    return [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount).slice(0, 6);
  }, [items, maintenanceLogs]);

  const loading = bike === undefined || rideStats === undefined || rides === undefined || fuelStats === undefined || fuelLogs === undefined || maintenanceStats === undefined || maintenanceLogs === undefined || expenses === undefined || expenseStats === undefined || items === undefined;
  if (loading) return <Page><LoadingState label="Building your riding insights…" /></Page>;

  const monthlyDistanceMax = Math.max(...monthly.map((entry) => entry.distance), 1);
  const sixMonthSpend = monthly.reduce((sum, entry) => sum + entry.spend, 0);
  const expenseMax = Math.max(...expenseCategories.map((entry) => entry.amount), 1);
  const maintenanceMax = Math.max(...maintCategories.map((entry) => entry.amount), 1);

  return (
    <Page eyebrow="Your riding data" title="Insights" subtitle="Summaries use your saved Convex records. Spending combines fuel, maintenance, and expenses.">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="ALL-TIME RIDES" value={km(rideStats.totalDistance)} detail={`${rideStats.totalRides} rides`} />
        <StatCard label="FUEL EFFICIENCY" value={`${fuelStats.avgKmPerLiter.toFixed(1)} km/L`} detail={`${fuelStats.totalLiters.toFixed(1)} L recorded`} />
        <StatCard label="SERVICE COST" value={php(maintenanceStats.totalCost)} detail={`${maintenanceStats.logCount} service logs`} />
        <StatCard label="EXPENSES" value={php(expenseStats.totalAmount)} detail={`${expenseStats.count} expense logs`} />
      </View>

      <Card>
        <SectionTitle title="Ride distance · 6 months" />
        {monthly.map((entry) => <BarRow key={`ride-${entry.label}`} label={entry.label} value={entry.distance} max={monthlyDistanceMax} caption={km(entry.distance)} color={colors.primary} />)}
      </Card>

      <Card>
        <SectionTitle title="Spending · 6 months" />
        <SpendingTrend data={monthly} color={colors.warning} gridColor={colors.border} mutedColor={colors.mutedForeground} total={sixMonthSpend} />
      </Card>

      <Card>
        <SectionTitle title="Expenses by category" />
        {expenseCategories.length ? [...expenseCategories].sort((a, b) => b.amount - a.amount).map((entry) => <BarRow key={entry.category} label={entry.category} value={entry.amount} max={expenseMax} caption={`${php(entry.amount)} · ${entry.count}`} color={colors.primary} />) : <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Expense categories appear after your first expense log.</Text>}
      </Card>

      <Card>
        <SectionTitle title="Maintenance costs by category" />
        {maintCategories.length ? maintCategories.map((entry) => <BarRow key={entry.category} label={entry.category} value={entry.amount} max={maintenanceMax} caption={php(entry.amount)} color={colors.success} />) : <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Add service logs with cost details to build this summary.</Text>}
      </Card>

      <Card>
        <SectionTitle title="Fuel summary" />
        <Text style={{ color: colors.foreground, fontSize: 14 }}>Fuel spend: {php(fuelStats.totalCost)}</Text>
        <Text style={{ color: colors.foreground, fontSize: 14 }}>Average price: {php(fuelStats.avgPricePerLiter)} / L</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{fuelLogs.length} latest fuel entries · Odometer {bike ? km(bike.currentOdometer) : "not set"}</Text>
      </Card>
    </Page>
  );
}
