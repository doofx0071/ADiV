import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { AppButton, Banner, Card, EmptyState, Page } from "@/components/ui";
import { useAppTheme } from "@/lib/theme";
import {
  activateOfflinePack,
  deleteOfflinePack,
  getActiveOfflinePack,
  importOfflinePackFromFolder,
  listOfflinePacks,
  verifyOfflinePack,
} from "@/lib/offline-pack-manager";
import type { InstalledOfflinePack } from "@/lib/offline-pack-contract";
import { Check, Database, Download, MapPin, RefreshCw, Trash2 } from "lucide-react-native";
import {
  cancelMapboxRegion,
  estimateMapboxRegion,
  getMapboxRegionStatus,
  hasMapboxToken,
  isMapboxExperimentEnabled,
  isMapboxAndroidReady,
  loadMapboxRegion,
  MAPBOX_STYLE_URI,
  onMapboxOfflineProgress,
  removeMapboxRegion,
  type MapboxOfflineProgress,
} from "@/lib/mapbox-bridge";

const MAPBOX_TEST_REGION_ID = "mapbox-ph-davao-test";
const MAPBOX_DAVAO_TEST_GEOMETRY: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[
    [125.15, 6.85],
    [125.85, 6.85],
    [125.85, 7.55],
    [125.15, 7.55],
    [125.15, 6.85],
  ]],
};

function PackCard({
  pack,
  active,
  busy,
  onActivate,
  onVerify,
  onDelete,
}: {
  pack: InstalledOfflinePack;
  active: boolean;
  busy: boolean;
  onActivate: () => void;
  onVerify: () => void;
  onDelete: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <MapPin size={19} color={colors.primary} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 16 }}>{pack.name}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>v{pack.version} · OSM data {pack.dataDate}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{(pack.sizeBytes / 1024 ** 3).toFixed(2)} GB on device</Text>
        </View>
        {active ? <Check size={19} color={colors.success} /> : null}
      </View>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>
        Coverage {pack.coverage[0].toFixed(2)}, {pack.coverage[1].toFixed(2)} to {pack.coverage[2].toFixed(2)}, {pack.coverage[3].toFixed(2)}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{pack.attribution}</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
        Offline map and place search · Offline turn-by-turn routing is not yet device-validated.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {!active ? <AppButton label="Use this pack" compact onPress={onActivate} busy={busy} icon={<Check size={15} color={colors.primary} />} /> : null}
        <AppButton label="Verify files" variant="outline" compact onPress={onVerify} busy={busy} icon={<RefreshCw size={15} color={colors.primary} />} />
        {!active ? <AppButton label="Delete" variant="danger" compact onPress={onDelete} busy={busy} icon={<Trash2 size={15} color="#fff" />} /> : null}
      </View>
    </Card>
  );
}

export default function OfflinePacksScreen() {
  const { colors } = useAppTheme();
  const [packs, setPacks] = useState<InstalledOfflinePack[]>([]);
  const [active, setActive] = useState<InstalledOfflinePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mapboxStatus, setMapboxStatus] = useState<Awaited<ReturnType<typeof getMapboxRegionStatus>> | null>(null);
  const [mapboxProgress, setMapboxProgress] = useState<MapboxOfflineProgress | null>(null);
  const [mapboxEstimate, setMapboxEstimate] = useState<Awaited<ReturnType<typeof estimateMapboxRegion>> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [installedResult, activeResult] = await Promise.allSettled([listOfflinePacks(), getActiveOfflinePack()]);
      if (installedResult.status === "rejected") throw installedResult.reason;
      setPacks(installedResult.value);
      if (activeResult.status === "fulfilled") {
        setActive(activeResult.value);
      } else {
        setActive(null);
        setError(activeResult.reason instanceof Error ? activeResult.reason.message : "The active offline map pack could not be loaded.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load installed map packs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([listOfflinePacks(), getActiveOfflinePack()])
      .then(([installedResult, activeResult]) => {
        if (!active) return;
        if (installedResult.status === "fulfilled") {
          setPacks(installedResult.value);
        } else {
          setError(installedResult.reason instanceof Error ? installedResult.reason.message : "Could not list installed map packs.");
        }
        if (activeResult.status === "fulfilled") {
          setActive(activeResult.value);
        } else {
          setActive(null);
          setError(activeResult.reason instanceof Error ? activeResult.reason.message : "The active offline map pack could not be loaded.");
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load installed map packs.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android" || !isMapboxAndroidReady()) return;
    let current = true;
    void getMapboxRegionStatus(MAPBOX_TEST_REGION_ID).then((status) => {
      if (current) setMapboxStatus(status);
    }).catch((reason: unknown) => {
      if (current) setError(reason instanceof Error ? reason.message : "Mapbox region status could not be read.");
    });
    const subscription = onMapboxOfflineProgress((event) => {
      if (event.regionId !== MAPBOX_TEST_REGION_ID) return;
      setMapboxProgress(event);
      if (event.asset === "complete") {
        void getMapboxRegionStatus(MAPBOX_TEST_REGION_ID).then(setMapboxStatus).catch(() => undefined);
      }
    });
    return () => {
      current = false;
      subscription?.remove();
    };
  }, []);

  async function withBusy(key: string, action: () => Promise<void>) {
    setBusyKey(key);
    setMessage("");
    setError("");
    try {
      await action();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The map pack operation failed.");
    } finally {
      setBusyKey("");
    }
  }

  const importPack = () => void withBusy("import", async () => {
    const installed = await importOfflinePackFromFolder();
    setMessage(`${installed.name} v${installed.version} was verified and installed. The recorder will use it as its offline map.`);
  });

  const downloadMapboxTestRegion = async () => {
    setBusyKey("mapbox-download");
    setError("");
    setMessage("");
    setMapboxProgress(null);
    try {
      const status = await loadMapboxRegion({
        regionId: MAPBOX_TEST_REGION_ID,
        geometry: MAPBOX_DAVAO_TEST_GEOMETRY,
        styleUri: MAPBOX_STYLE_URI,
        minZoom: 6,
        maxZoom: 16,
      });
      setMapboxStatus(status);
      setMessage("Davao test-region style, map tiles, and routing tiles downloaded. Airplane-mode cold-start routing still needs device acceptance testing.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Mapbox offline region could not be downloaded.");
      try {
        setMapboxStatus(await getMapboxRegionStatus(MAPBOX_TEST_REGION_ID));
      } catch {
        setMapboxStatus(null);
      }
    } finally {
      setBusyKey("");
      setMapboxProgress(null);
    }
  };

  const estimateMapboxTestRegion = async () => {
    setBusyKey("mapbox-estimate");
    setError("");
    setMessage("");
    setMapboxProgress(null);
    setMapboxEstimate(null);
    try {
      const estimate = await estimateMapboxRegion({
        regionId: MAPBOX_TEST_REGION_ID,
        geometry: MAPBOX_DAVAO_TEST_GEOMETRY,
        styleUri: MAPBOX_STYLE_URI,
        minZoom: 6,
        maxZoom: 16,
      });
      setMapboxEstimate(estimate);
      setMessage("Mapbox estimated the map and routing TileStore size. The style pack is separate, and the downloaded size can differ.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mapbox could not estimate this offline region.");
    } finally {
      setBusyKey("");
      setMapboxProgress(null);
    }
  };

  const removeMapboxTestRegion = () => {
    Alert.alert("Remove Mapbox test region?", "The Davao style pack and tile region will be marked for removal. Android may reclaim tile storage during later cleanup.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void withBusy("mapbox-remove", async () => {
        await removeMapboxRegion(MAPBOX_TEST_REGION_ID, MAPBOX_STYLE_URI);
        setMapboxStatus({ regionId: MAPBOX_TEST_REGION_ID, styleReady: false, mapTilesReady: false, routingTilesReady: false });
        setMessage("The Mapbox Davao test region was removed from the region manager.");
      }) },
    ]);
  };

  const confirmDelete = (pack: InstalledOfflinePack) => {
    Alert.alert("Delete offline pack?", `${pack.name} v${pack.version} will be removed from this device.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void withBusy(`${pack.packId}@${pack.version}`, async () => {
        await deleteOfflinePack(pack.packId, pack.version);
        setMessage(`${pack.name} v${pack.version} was deleted.`);
      }) },
    ]);
  };

  return (
    <Page back eyebrow="Android map data" title="Offline map packs" subtitle="Import self-contained map and place-search data. Packs stay on this device.">
      {Platform.OS !== "android" ? (
        <Banner title="Android only" body="Offline map packs are supported on Android. This screen does not enable offline iOS maps." />
      ) : null}
      {Platform.OS === "android" ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <MapPin size={19} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 15 }}>Mapbox Davao test region</Text>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>
            Downloads Mapbox Streets style assets plus map and Navigation routing tiles for a rectangular Davao test area at zooms 6–16. The selected route profile is driving; motorcycle road suitability and airplane-mode routing still need physical-device checks. This is a test area, not Philippines-wide coverage.
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
            Storage estimates and downloads contact Mapbox and may count toward account usage. Free-tier eligibility for private motorcycle navigation has not been confirmed; use these controls only after reviewing your account and license terms.
          </Text>
          {!isMapboxExperimentEnabled() ? (
            <Banner title="Mapbox experiment disabled" body="Mapbox is disabled by default. The current Terms require a vehicle-use development license for non-production use, so do not enable this while seeking a $0 setup. Existing MapLibre and imported offline packs remain available." />
          ) : !hasMapboxToken() ? (
            <Banner title="Public token required" body="Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to a Mapbox public pk. token in the mobile build environment, then rebuild the Android app. No token is currently configured." />
          ) : !isMapboxAndroidReady() ? (
            <Banner title="Native rebuild required" body="The current app binary does not include the Android Mapbox TileStore bridge. Rebuild the Android development or release app after Expo prebuild." />
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <AppButton
              label={busyKey === "mapbox-estimate" ? "Estimating storage…" : "Estimate storage"}
              variant="outline"
              onPress={() => void estimateMapboxTestRegion()}
              busy={busyKey === "mapbox-estimate"}
              disabled={!isMapboxAndroidReady() || busyKey === "mapbox-estimate" || busyKey === "mapbox-download"}
              icon={<Database size={16} color={colors.primary} />}
            />
            <AppButton
              label={busyKey === "mapbox-download" ? "Downloading Mapbox tiles…" : "Download Davao test region"}
              onPress={() => void downloadMapboxTestRegion()}
              busy={busyKey === "mapbox-download"}
              disabled={!isMapboxAndroidReady() || busyKey === "mapbox-download" || busyKey === "mapbox-estimate"}
              icon={<Download size={16} color="#fff" />}
            />
            {busyKey === "mapbox-download" ? (
              <AppButton label="Cancel download" variant="outline" onPress={() => cancelMapboxRegion(MAPBOX_TEST_REGION_ID)} />
            ) : null}
            {busyKey === "mapbox-estimate" ? (
              <AppButton label="Cancel estimate" variant="outline" onPress={() => cancelMapboxRegion(MAPBOX_TEST_REGION_ID)} />
            ) : null}
            {(mapboxStatus?.styleReady || mapboxStatus?.mapTilesReady || mapboxStatus?.routingTilesReady) && busyKey !== "mapbox-download" && busyKey !== "mapbox-estimate" ? (
              <AppButton label="Remove Mapbox region" variant="danger" onPress={removeMapboxTestRegion} busy={busyKey === "mapbox-remove"} />
            ) : null}
          </View>
          {mapboxProgress ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {mapboxProgress.asset === "style" ? "Style pack" : mapboxProgress.asset === "map-and-routing" ? "Map and routing tiles" : mapboxProgress.asset === "estimate" ? "Estimate metadata" : "Complete"} · {mapboxProgress.percent}%
            </Text>
          ) : null}
          {mapboxEstimate ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
              Estimated map + routing storage: {(mapboxEstimate.storageSizeBytes / (1024 * 1024)).toFixed(1)} MB · transfer: {(mapboxEstimate.transferSizeBytes / (1024 * 1024)).toFixed(1)} MB · error margin {Math.round(mapboxEstimate.errorMargin * 100)}%. The style pack is excluded. This is a Mapbox network request and does not guarantee a $0 account or vehicle-use license.
            </Text>
          ) : null}
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            Readiness · style {mapboxStatus?.styleReady ? "ready" : "missing"} · map {mapboxStatus?.mapTilesReady ? "ready" : "missing"} · routing {mapboxStatus?.routingTilesReady ? "ready" : "missing"}
          </Text>
          {mapboxStatus?.tileRegionBytes !== undefined ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              Map + routing region: {(mapboxStatus.tileRegionBytes / (1024 * 1024)).toFixed(1)} MB measured after download. The style pack is separate and is not included in this size.
            </Text>
          ) : null}
          {mapboxStatus?.mapsSdkVersion || mapboxStatus?.navigationSdkVersion ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              Map SDK {mapboxStatus.mapsSdkVersion ?? "unknown"} · Navigation SDK {mapboxStatus.navigationSdkVersion ?? "unknown"} · profile {mapboxStatus.routingProfile ?? "unknown"}
              {mapboxStatus.lastUpdatedAt ? ` · updated ${new Date(mapboxStatus.lastUpdatedAt).toLocaleString()}` : ""}
            </Text>
          ) : null}
        </Card>
      ) : null}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <Database size={19} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 15 }}>Install a pack folder</Text>
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>
          Choose a folder containing manifest.json, a PMTiles map, a local Shortbread style and glyphs/sprites, and a SQLite FTS5 place index. Every listed file is checked before the new version becomes active; the previous version stays installed if a check fails.
        </Text>
        <AppButton label="Choose pack folder" onPress={importPack} busy={busyKey === "import"} disabled={Platform.OS !== "android"} icon={<Download size={17} color="#fff" />} />
      </Card>

      {error ? <Banner title="Pack manager" body={error} tone="warning" /> : null}
      {message ? <Banner title="Pack manager" body={message} tone="success" /> : null}
      {active ? (
        <Card>
          <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 15 }}>Active offline map</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{active.name} · OSM data {active.dataDate}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{active.attribution}</Text>
        </Card>
      ) : null}

      {loading ? (
        <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 16 }}>Reading installed packs…</Text>
      ) : packs.length ? (
        packs.map((pack) => (
          <PackCard
            key={`${pack.packId}@${pack.version}`}
            pack={pack}
            active={active?.packId === pack.packId && active.version === pack.version}
            busy={busyKey === `${pack.packId}@${pack.version}`}
            onActivate={() => void withBusy(`${pack.packId}@${pack.version}`, async () => {
              await activateOfflinePack(pack.packId, pack.version);
              setMessage(`${pack.name} v${pack.version} is now active.`);
            })}
            onVerify={() => void withBusy(`${pack.packId}@${pack.version}`, async () => {
              const result = await verifyOfflinePack(pack.packId, pack.version);
              if (!result.valid) throw new Error(result.error ?? "Pack verification failed.");
              setMessage(`${pack.name} v${pack.version} passed its checksum, style, and FTS5 checks.`);
            })}
            onDelete={() => confirmDelete(pack)}
          />
        ))
      ) : (
        <EmptyState title="No offline packs installed" body="The recorder will use its online CARTO basemap until you import a verified local pack." />
      )}
    </Page>
  );
}
