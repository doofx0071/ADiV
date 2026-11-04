import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Activity, ArrowUpRight, Map, RotateCcw, Trash2 } from "lucide-react-native";
import { AppText as Text } from "@/components/app-text";
import { AppButton, Banner, Card, Page, SectionTitle, StatCard } from "@/components/ui";
import { clearMapActivityLog, getMapActivitySnapshot, type MapActivitySnapshot } from "@/lib/mapbox-usage";
import { useAppTheme } from "@/lib/theme";

const MAPBOX_STATISTICS_URL = "https://console.mapbox.com/account/statistics/";

// These free-tier amounts are copied from the user's Mapbox dashboard screenshot.
// They are display references only and are never used to estimate Mapbox billing.
const DASHBOARD_TIER_REFERENCE = [
  { name: "Map Loads for Web", observed: "Not used by this Android map", tier: "50k free loads" },
  { name: "Static Tiles API", observed: "No direct API call in this app", tier: "200k free tile requests" },
  { name: "Static Images API", observed: "No direct API call in this app", tier: "50k free requests" },
  { name: "Maps SDKs for Mobile", observed: "See successful style loads below", tier: "25k free monthly active users" },
];

function formatWhen(timestamp: number | null | undefined): string {
  if (!timestamp) return "No activity recorded";
  return new Date(timestamp).toLocaleString();
}

function MetricRow({ label, detail, value, colors, lastAt }: {
  label: string;
  detail: string;
  value: number;
  colors: ReturnType<typeof useAppTheme>["colors"];
  lastAt: number | null;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "800" }}>{label}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>{detail}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Last: {formatWhen(lastAt)}</Text>
      </View>
      <Text style={{ color: colors.foreground, fontSize: 21, fontWeight: "900", minWidth: 30, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

function TierRow({ name, observed, tier, colors, isLast }: {
  name: string;
  observed: string;
  tier: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
  isLast: boolean;
}) {
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: isLast ? 0 : 1, borderColor: colors.border, gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "800", flex: 1 }}>{name}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "right", flex: 1 }}>{tier}</Text>
      </View>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>{observed}</Text>
    </View>
  );
}

export default function UsageScreen() {
  const { colors } = useAppTheme();
  const [snapshot, setSnapshot] = useState<MapActivitySnapshot | null>(null);
  const [openingDashboard, setOpeningDashboard] = useState(false);

  const refresh = useCallback(async () => {
    setSnapshot(await getMapActivitySnapshot());
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const metrics = snapshot?.metrics;
  const totalMapboxLoads = metrics?.mapboxMapStyleLoaded.count ?? 0;
  const totalMapLibreLoads = metrics?.mapLibreMapStyleLoaded.count ?? 0;

  async function openDashboard() {
    setOpeningDashboard(true);
    try {
      await Linking.openURL(MAPBOX_STATISTICS_URL);
    } catch {
      Alert.alert("Could not open Mapbox", "Open console.mapbox.com/account/statistics in your browser.");
    } finally {
      setOpeningDashboard(false);
    }
  }

  function confirmClear() {
    Alert.alert("Clear this device's usage log?", "This only resets ADiV's local counters. It does not change your Mapbox account statistics.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear log", style: "destructive", onPress: () => { void clearMapActivityLog().then(refresh); } },
    ]);
  }

  return (
    <Page back eyebrow="Map services" title="Usage" subtitle="A private activity log from this app install, with a shortcut to your account's live statistics.">
      <Banner
        title="Local activity is not Mapbox billing data"
        body="Mapbox usage can take up to 24 hours to appear in the account dashboard. ADiV cannot read your account totals, so the counters below report app events only."
        tone="warning"
      />

      <Card>
        <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
          <Activity size={18} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "900" }}>Activity on this device</Text>
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
          Counters are saved only on this phone and can be cleared below. No token, location, search, or route data is saved here.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <StatCard label="Mapbox styles loaded" value={String(totalMapboxLoads)} detail="Successful native map style events" />
          <StatCard label="MapLibre styles loaded" value={String(totalMapLibreLoads)} detail="Fallback map provider; separate counter" />
        </View>
        {metrics ? <>
          <MetricRow label="Mapbox routes calculated" detail="Successful route responses from the native bridge" value={metrics.routeRequestSucceeded.count} colors={colors} lastAt={metrics.routeRequestSucceeded.lastAt} />
          <MetricRow label="Guidance sessions started" detail="Successful starts requested by Navigate + Record" value={metrics.guidanceStartSucceeded.count} colors={colors} lastAt={metrics.guidanceStartSucceeded.lastAt} />
          <MetricRow label="Offline region download attempts" detail="Requested region downloads; completion is tracked separately in Offline map packs" value={metrics.offlineRegionLoadRequested.count} colors={colors} lastAt={metrics.offlineRegionLoadRequested.lastAt} />
        </> : null}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><AppButton label="Refresh local log" onPress={() => void refresh()} variant="secondary" icon={<RotateCcw size={17} color={colors.foreground} />} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Clear this device's usage log" onPress={confirmClear} style={{ width: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
            <Trash2 size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </Card>

      <Card>
        <SectionTitle title="Maps · service tier reference" />
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
          Free-tier amounts below are copied from your dashboard screenshot, not fetched live. They may change. App-observed counts are not comparable to account billable units.
        </Text>
        {DASHBOARD_TIER_REFERENCE.map((item, index) => (
          <TierRow key={item.name} {...item} colors={colors} isLast={index === DASHBOARD_TIER_REFERENCE.length - 1} />
        ))}
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
          The Android Maps SDK is billed by monthly active users, not map-style-load count. A single device may be one MAU even if it renders the map repeatedly. Native SDK tile traffic is not the Static Tiles API row.
        </Text>
        <AppButton label={openingDashboard ? "Opening…" : "Open Mapbox Statistics"} onPress={() => void openDashboard()} busy={openingDashboard} variant="outline" icon={<ArrowUpRight size={17} color={colors.foreground} />} />
      </Card>

      <Card style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <Map size={18} color={colors.primary} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "800" }}>Search provider</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
            Offline matches use the local SQLite index. Online search uses Photon/OpenStreetMap, not Mapbox Search, so it does not add Mapbox Search API usage.
          </Text>
        </View>
      </Card>
    </Page>
  );
}
