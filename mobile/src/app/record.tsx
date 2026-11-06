import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Linking, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { AppText as Text } from "@/components/app-text";
import { router, useFocusEffect, useGlobalSearchParams, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import * as Network from "expo-network";
import { Check, Disc, Expand, Eye, EyeOff, ExternalLink, Flag, MapPin, Minimize2, Navigation, Search, Square, X } from "lucide-react-native";
import { api } from "@/lib/api";
import { AppButton, Banner, Field, LoadingState, Page, StatCard } from "@/components/ui";
import { km } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";
import { getMapStyle, boundsFor, routeFeatureCollection } from "@/lib/map-style";
import { RideMap, type RideCameraHandle, type RideMapHandle } from "@/components/ride-map";
import {
  addMapboxListener,
  configureMapbox,
  hasMapboxToken,
  isMapboxExperimentEnabled,
  isMapboxAndroidReady,
  MAPBOX_STYLE_URI,
  releaseMapboxRoute,
  startMapboxGuidance,
  stopMapboxGuidance,
} from "@/lib/mapbox-bridge";
import { haversineMeters, trackDistanceKm, trackMaxSpeedKmh, type TrackPoint } from "@/lib/shared";
import { searchPlaces, type PlaceResult } from "@/lib/geocode";
import { searchOfflinePlaces } from "@/lib/offline-search";
import { getActiveOfflineMap } from "@/lib/offline-pack-manager";
import type { InstalledOfflinePack } from "@/lib/offline-pack-contract";
import {
  distanceToRouteMeters,
  metersToStep,
  planRoute,
  SPEAK_DISTANCE_METERS,
  updateRerouteHysteresis,
  type PlannedRoute,
  type RerouteHysteresisState,
} from "@/lib/navigation";
import {
  currentPosition,
  discardRecording,
  getActiveRideMode,
  finishRecording,
  getTrackPoints,
  loadActiveRide,
  reconcileActiveRecording,
  pauseRecording,
  startRecording,
  subscribeToTrack,
} from "@/lib/ride-tracker";
import { saveRideSummary } from "@/lib/local-ride-store";
import { clearActiveRideRoute, loadActiveRideRoute, saveActiveRideRoute } from "@/lib/active-ride-route";
import { activeRideElapsedMs, buildRideSummaryPayload, restoredRecorderPhase, type RecorderPhase, type RideMode } from "@/lib/ride-model";
import { requestRideNotificationPermission } from "@/lib/ride-notification";
import { useShareSafeQuery } from "@/lib/share-safe-query";

const MS_PER_HOUR = 3_600_000;
/** Group track points into continuous runs (pause/resume splits runs). */
function runsOf(points: TrackPoint[]): Map<number, [number, number][]> {
  const runs = new Map<number, [number, number][]>();
  for (const point of points) {
    const run = runs.get(point.runId ?? 1) ?? [];
    run.push([point.lon, point.lat]);
    runs.set(point.runId ?? 1, run);
  }
  return runs;
}

export default function RecordScreen() {
  const { colors, resolved } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const globalParams = useGlobalSearchParams<{ rideId?: string }>();
  const bike = useShareSafeQuery(api.bike.getBike);
  const [ready, setReady] = useState(false);
  const [refreshingRide, setRefreshingRide] = useState(false);
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [rideId, setRideId] = useState<string | null>(null);
  const [rideStartedAt, setRideStartedAt] = useState<number | null>(null);
  const [rideEndedAt, setRideEndedAt] = useState<number | null>(null);
  const [rideElapsedMs, setRideElapsedMs] = useState(0);
  const [rideRunStartedAt, setRideRunStartedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notificationUnavailable, setNotificationUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [startOdometerInput, setStartOdometerInput] = useState("");
  const [updateCurrentOdometer, setUpdateCurrentOdometer] = useState(false);
  const [notes, setNotes] = useState("");
  const [restoredMode, setRestoredMode] = useState<RideMode | null>(null);

  // Guided navigation: search or pin a destination, plan a route, voice
  // callouts announce maneuvers as you approach them.
  const params = useLocalSearchParams<{ mode?: RideMode }>();
  const navigationFirst = params.mode === "navigateAndRecord"
    || (params.mode === undefined && restoredMode === "navigateAndRecord");
  const [planning, setPlanning] = useState(navigationFirst);
  const [showMap, setShowMap] = useState(navigationFirst);
  const [guidanceActive, setGuidanceActive] = useState(false);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [summaryCameraMode, setSummaryCameraMode] = useState<"route" | "end">("route");
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [planned, setPlanned] = useState<PlannedRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeNeedsRefresh, setRouteNeedsRefresh] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searchSource, setSearchSource] = useState<"offline" | "offline-only" | "online" | "online+offline" | "unavailable" | null>(null);
  const [coordinateText, setCoordinateText] = useState("");
  const [showCoordinateEntry, setShowCoordinateEntry] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [offlineMap, setOfflineMap] = useState<{ pack: InstalledOfflinePack; style: string } | null | undefined>(undefined);
  const [mapboxConfigured, setMapboxConfigured] = useState(false);
  const [mapboxSetupError, setMapboxSetupError] = useState("");
  const [mapboxProgress, setMapboxProgress] = useState<{ instruction: string; distanceMeters: number } | null>(null);
  const mapRef = useRef<RideMapHandle>(null);
  const cameraRef = useRef<RideCameraHandle>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const rerouteAbortRef = useRef<AbortController | null>(null);

  // The tracker buffer is module-level; mirror it into state for rendering.
  const pointsRef = useRef<TrackPoint[]>([]);
  const rerouteStateRef = useRef<RerouteHysteresisState>({ consecutiveOffRouteFixes: 0, lastRerouteAt: 0 });
  const reroutingRef = useRef(false);
  const announcedStepRef = useRef<{ planned: PlannedRoute; stepIndex: number } | null>(null);
  const latestPlannedRef = useRef(planned);
  const resumeGuidanceAfterPauseRef = useRef(false);
  const routeRestoreAttemptedRef = useRef(false);
  const rideRefreshCountRef = useRef(0);

  const stopGuidance = useCallback(() => {
    routeAbortRef.current?.abort();
    rerouteAbortRef.current?.abort();
    reroutingRef.current = false;
    setRouteLoading(false);
    setGuidanceActive(false);
    Speech.stop();
    stopMapboxGuidance();
  }, []);

  const handleStopGuidance = useCallback(() => {
    stopGuidance();
    resumeGuidanceAfterPauseRef.current = false;
    setPlanning(false);
    setError("Guidance stopped. The same ride is still recording.");
  }, [stopGuidance]);

  const handlePlanNextLeg = useCallback(() => {
    stopGuidance();
    releaseMapboxRoute(latestPlannedRef.current?.routeId);
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    setSearchQuery("");
    setSearchResults([]);
    setSearchSource(null);
    setSearching(false);
    setPlanning(true);
    setDestination(null);
    setPlanned(null);
    setRouteNeedsRefresh(false);
    void clearActiveRideRoute().catch(() => undefined);
    setStepIndex(0);
    setError("");
  }, [stopGuidance]);

  const handleResumeGuidance = useCallback(async () => {
    if (!planned) return;
    setError("");
    if (planned.provider === "mapbox-navigation" && planned.routeId) {
      try {
        await startMapboxGuidance(planned.routeId, planned.offlineOnly === true);
      } catch (resumeError) {
        stopMapboxGuidance();
        setError(resumeError instanceof Error ? resumeError.message : "Mapbox guidance could not resume.");
        return;
      }
    }
    setPlanning(false);
    setStepIndex(0);
    setGuidanceActive(true);
    setFollowUser(true);
    Speech.stop();
  }, [planned]);

  useEffect(() => {
    latestPlannedRef.current = planned;
  }, [planned]);

  useEffect(() => {
    if (params.mode !== undefined) return;
    let current = true;
    void (async () => {
      const active = await reconcileActiveRecording() ?? await loadActiveRide();
      if (!current || !active || active.status === "completed") return;
      const mode = await getActiveRideMode();
      if (!current || !mode) return;
      setRestoredMode(mode);
      if (mode === "navigateAndRecord") {
        setPlanning(true);
        setShowMap(true);
      }
    })().catch(() => undefined);
    return () => { current = false; };
  }, [params.mode]);

  useFocusEffect(useCallback(() => {
    let current = true;
    void getActiveOfflineMap().then((map) => {
      if (current) setOfflineMap(map);
    }).catch(() => {
      if (current) {
        setOfflineMap(null);
        setError("The active offline map pack could not be loaded. Verify it or activate another pack from Offline map packs.");
      }
    });
    return () => { current = false; };
  }, []));

  useEffect(() => {
    const mapRequested = (navigationFirst || showMap) && !globalParams.rideId;
    if (!mapRequested || Platform.OS !== "android") return;
    if (!isMapboxExperimentEnabled() || !hasMapboxToken()) return;
    if (!isMapboxAndroidReady()) {
      let current = true;
      void Promise.resolve().then(() => {
        if (!current) return;
        setMapboxConfigured(false);
        setMapboxSetupError("This native build does not include the Mapbox tile-store bridge yet. Rebuild the Android app after prebuild.");
      });
      return () => { current = false; };
    }
    let current = true;
    void configureMapbox().then(() => {
      if (current) {
        setMapboxSetupError("");
        setMapboxConfigured(true);
      }
    }).catch((configureError: unknown) => {
      if (current) {
        setMapboxConfigured(false);
        setMapboxSetupError(configureError instanceof Error ? configureError.message : "Mapbox could not initialize.");
      }
    });
    return () => { current = false; };
  }, [navigationFirst, showMap, globalParams.rideId]);

  useEffect(() => {
    void (async () => {
      const restored = await reconcileActiveRecording() ?? await loadActiveRide();
      if (restored) {
        pointsRef.current = restored.points;
        setPoints(restored.points);
        setRideId(restored.id);
        setRideStartedAt(restored.startedAt);
        setRideEndedAt(restored.endedAt);
        setRideElapsedMs(restored.elapsedMs);
        setRideRunStartedAt(restored.runStartedAt);
        setNow(Date.now());
        setError(restored.trackingIssue ?? "");
        const restoredPhase = restoredRecorderPhase(restored.status, restored.interrupted);
        setPhase(restoredPhase);
        if (restoredPhase === "summary" && navigationFirst) {
          setSummaryCameraMode("route");
          setFollowUser(true);
          setFullscreenMap(true);
          router.setParams({ fullscreen: "true" });
        }
        if (bike) setStartOdometerInput(String(Math.round(bike.currentOdometer)));
      } else if (Platform.OS === "web") {
        setError("Ride recording needs the Android app. Open ADiV on your phone to record.");
      }
      setReady(true);
    })();
  }, [bike, navigationFirst]);

  const refreshRideFromStore = useCallback(async () => {
    rideRefreshCountRef.current += 1;
    setRefreshingRide(true);
    try {
      const restored = await reconcileActiveRecording() ?? await loadActiveRide();
      if (!restored) return;
      pointsRef.current = restored.points;
      setPoints(restored.points);
      setRideId(restored.id);
      setRideStartedAt(restored.startedAt);
      setRideEndedAt(restored.endedAt);
      setRideElapsedMs(restored.elapsedMs);
      setRideRunStartedAt(restored.runStartedAt);
      setNow(Date.now());
      setError(restored.trackingIssue ?? "");
      const restoredPhase = restoredRecorderPhase(restored.status, restored.interrupted);
      setPhase(restoredPhase);
      if (restoredPhase === "summary" && navigationFirst) {
        setSummaryCameraMode("route");
        setFollowUser(true);
        setFullscreenMap(true);
        router.setParams({ fullscreen: "true" });
      }
      if (bike) setStartOdometerInput((value) => value || String(Math.round(bike.currentOdometer)));
    } finally {
      rideRefreshCountRef.current = Math.max(0, rideRefreshCountRef.current - 1);
      if (rideRefreshCountRef.current === 0) setRefreshingRide(false);
    }
  }, [bike, navigationFirst]);

  useFocusEffect(useCallback(() => {
    void refreshRideFromStore().catch(() => undefined);
  }, [refreshRideFromStore]));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshRideFromStore().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [refreshRideFromStore]);

  useEffect(() => {
    if (phase !== "recording") return;
    const unsubscribe = subscribeToTrack((point) => {
      pointsRef.current = [...pointsRef.current.filter((p) => p.ts !== point.ts), point];
      setPoints(pointsRef.current);
    });
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      unsubscribe();
      clearInterval(tick);
    };
  }, [phase]);

  const stats = useMemo(() => {
    const distanceKm = trackDistanceKm(points);
    const elapsedMs = activeRideElapsedMs({
      elapsedMs: rideElapsedMs,
      runStartedAt: rideRunStartedAt,
      status: phase === "recording" ? "recording" : "paused",
    }, now);
    const hours = elapsedMs / MS_PER_HOUR;
    const maxSpeedKmh = trackMaxSpeedKmh(points);
    const avgSpeedKmh = hours > 0 ? distanceKm / hours : 0;
    return { distanceKm, elapsedMs, maxSpeedKmh, avgSpeedKmh };
  }, [points, now, rideElapsedMs, rideRunStartedAt, phase]);

  const routeGeoJSON = useMemo(
    () => routeFeatureCollection([...runsOf(points).values()]),
    [points],
  );

  const plannedGeoJSON = useMemo(() => {
    if (!planned) return { type: "FeatureCollection" as const, features: [] };
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: planned.coordinates },
        },
      ],
    };
  }, [planned]);
  const trackBounds = useMemo(
    () => points.length >= 2 ? boundsFor(points.map((point) => [point.lon, point.lat])) : null,
    [points],
  );

  const choosePlace = useCallback(async (
    place: PlaceResult,
    options: { resumeGuidance?: boolean; preservePreviewOnFailure?: boolean } = {},
  ): Promise<PlannedRoute | null> => {
    searchAbortRef.current?.abort();
    setSearchQuery("");
    setSearchResults([]);
    setSearchSource(null);
    setSearching(false);
    routeAbortRef.current?.abort();
    const request = new AbortController();
    routeAbortRef.current = request;
    setDestination([place.lon, place.lat]);
    setPlanned((current) => options.preservePreviewOnFailure ? current : null);
    setRouteNeedsRefresh(Boolean(options.preservePreviewOnFailure));
    if (!options.preservePreviewOnFailure) {
      await saveActiveRideRoute({ destination: place, planned: null }).catch(() => undefined);
    }
    setFollowUser(false);
    requestAnimationFrame(() => cameraRef.current?.easeTo({ center: [place.lon, place.lat], zoom: 15, duration: 400 }));
    setRouteLoading(true);
    setError("");
    try {
      const network = await Network.getNetworkStateAsync().catch(() => null);
      const offlineOnly = network?.isConnected !== true || network.isInternetReachable === false;
      if (offlineOnly && !isMapboxAndroidReady()) {
        setError("Destination selected. Offline turn-by-turn routing needs Mapbox Navigation tiles in an Android build. No online router was used.");
        return null;
      }
      const last = pointsRef.current[pointsRef.current.length - 1];
      const from = last ? ([last.lon, last.lat] as [number, number]) : await currentPosition({ requestPermission: true });
      if (!from) {
        setError("No GPS fix yet — step outside and try again.");
        return null;
      }
      const route = await planRoute(from, [place.lon, place.lat], { signal: request.signal, offlineOnly });
      if (request.signal.aborted) return null;
      releaseMapboxRoute(latestPlannedRef.current?.routeId);
      setPlanned(route);
      setRouteNeedsRefresh(false);
      await saveActiveRideRoute({ destination: place, planned: route }).catch(() => undefined);
      setMapboxProgress(null);
      setStepIndex(0);
      setFollowUser(false);
      cameraRef.current?.fitBounds(
        boundsFor(route.coordinates),
        { padding: { top: 64, right: 28, bottom: 120, left: 28 }, duration: 650 },
      );
      if (options.resumeGuidance) {
        if (route.provider === "mapbox-navigation" && route.routeId) {
          await startMapboxGuidance(route.routeId, route.offlineOnly === true);
        }
        setPlanning(false);
        setGuidanceActive(true);
        setFollowUser(true);
        resumeGuidanceAfterPauseRef.current = true;
      }
      return route;
    } catch (e) {
      if (!request.signal.aborted) {
        if (!options.preservePreviewOnFailure) setPlanned(null);
        setRouteNeedsRefresh(Boolean(options.preservePreviewOnFailure));
        setError(e instanceof Error ? e.message : "Could not plan the route.");
      }
      return null;
    } finally {
      if (routeAbortRef.current === request) {
        routeAbortRef.current = null;
        setRouteLoading(false);
      }
    }
  }, []);

  const handleLongPress = useCallback(
    async (event: { nativeEvent: { lngLat: [number, number] } }) => {
      if (!planning || (phase === "recording" && guidanceActive)) return;
      const to = event.nativeEvent.lngLat;
      await choosePlace({ label: "Pinned destination", lat: to[1], lon: to[0] });
    },
    [planning, phase, guidanceActive, choosePlace],
  );

  useEffect(() => {
    if (!ready || !navigationFirst || globalParams.rideId || routeRestoreAttemptedRef.current) return;
    routeRestoreAttemptedRef.current = true;
    let current = true;
    void loadActiveRideRoute().then(async (saved) => {
      if (!current || !saved) return;
      setDestination([saved.destination.lon, saved.destination.lat]);
      setShowMap(true);
      setStepIndex(0);

      if (saved.planned?.provider === "online-osrm") {
        setPlanned(saved.planned);
        setRouteNeedsRefresh(false);
        setPlanning(phase !== "recording");
        setGuidanceActive(phase === "recording");
        resumeGuidanceAfterPauseRef.current = true;
        if (phase === "recording") setFollowUser(true);
        return;
      }

      if (saved.planned) {
        // Native Mapbox route IDs expire with their navigation session. Keep
        // the saved preview visible while rebuilding a route to the destination.
        setPlanned(saved.planned);
        setRouteNeedsRefresh(true);
      }
      resumeGuidanceAfterPauseRef.current = phase !== "recording";
      setPlanning(phase !== "recording");
      await choosePlace(saved.destination, {
        resumeGuidance: phase === "recording",
        preservePreviewOnFailure: Boolean(saved.planned),
      });
    }).catch(() => undefined);
    return () => { current = false; };
  }, [ready, navigationFirst, globalParams.rideId, phase, choosePlace]);

  useEffect(() => {
    const query = searchQuery.trim();
    searchAbortRef.current?.abort();
    if (globalParams.rideId || query.length < 2 || offlineMap === undefined) return undefined;
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const timeout = setTimeout(() => {
      void (async () => {
        const last = pointsRef.current[pointsRef.current.length - 1];
        const packBounds = offlineMap?.pack.coverage;
        const position = last
          ? ([last.lon, last.lat] as [number, number])
          : packBounds
            ? ([(packBounds[0] + packBounds[2]) / 2, (packBounds[1] + packBounds[3]) / 2] as [number, number])
            : undefined;
        const offlinePromise = offlineMap
          ? searchOfflinePlaces(query).catch(() => [] as PlaceResult[])
          : Promise.resolve([] as PlaceResult[]);
        const networkPromise = Network.getNetworkStateAsync().catch(() => null);
        const offline = await offlinePromise;
        if (controller.signal.aborted) return;
        if (offline.length > 0) {
          setSearchResults(offline);
          setSearchSource("offline");
        }
        const network = await networkPromise;
        if (controller.signal.aborted) return;
        const canSearchOnline = network?.isConnected === true && network.isInternetReachable !== false;
        if (offline.length === 0) setSearchResults([]);
        setSearchSource(!canSearchOnline ? "offline-only" : offline.length > 0 ? "offline" : "online");
        if (!canSearchOnline) {
          setSearching(false);
          return;
        }

        let online: PlaceResult[] = [];
        let onlineUnavailable = false;
        try {
          online = await searchPlaces(query, { signal: controller.signal, position });
        } catch {
          if (controller.signal.aborted) return;
          onlineUnavailable = true;
        }
        if (controller.signal.aborted) return;
        const merged: PlaceResult[] = [...online];
        for (const local of offline) {
          const duplicateIndex = merged.findIndex((remote) => {
            const sameLabel = remote.label.trim().toLocaleLowerCase() === local.label.trim().toLocaleLowerCase();
            const meters = Math.hypot(
              (remote.lon - local.lon) * 111_000 * Math.cos((local.lat * Math.PI) / 180),
              (remote.lat - local.lat) * 111_000,
            );
            return sameLabel || meters < 50;
          });
          if (duplicateIndex >= 0) {
            merged[duplicateIndex] = { ...merged[duplicateIndex], source: "offline+online" };
          } else {
            merged.push(local);
          }
        }
        setSearchResults(merged.slice(0, 12));
        setSearchSource(onlineUnavailable && offline.length === 0
          ? "unavailable"
          : online.length > 0 && offline.length > 0
            ? "online+offline"
            : offline.length > 0
              ? "offline"
              : "online");
        setSearching(false);
      })().catch(() => {
        if (!controller.signal.aborted) {
          setSearchResults([]);
          setSearchSource(offlineMap ? "offline" : "online");
          setSearching(false);
        }
      });
    }, 160);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery, offlineMap, globalParams.rideId]);

  const handleSearchInput = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      searchAbortRef.current?.abort();
      setSearchResults([]);
      setSearchSource(null);
      setSearching(false);
    } else {
      setSearchResults([]);
      setSearching(true);
    }
  }, []);

  const handlePinHere = useCallback(async () => {
    const center = await mapRef.current?.getCenter();
    if (!center) {
      setError("The map is still loading — try again in a moment.");
      return;
    }
    setPinMode(false);
    await choosePlace({ label: "Pinned destination", lat: center[1], lon: center[0] });
  }, [choosePlace]);

  const handleCoordinateEntry = useCallback(async () => {
    const parts = coordinateText.trim().split(/[\s,;]+/).filter(Boolean);
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (parts.length !== 2 || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError("Enter coordinates as latitude, longitude. Latitude must be −90 to 90 and longitude −180 to 180.");
      return;
    }
    setShowCoordinateEntry(false);
    await choosePlace({ label: `Coordinates ${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon });
  }, [coordinateText, choosePlace]);

  const handleRecenter = useCallback(async () => {
    if (phase === "summary" && pointsRef.current.length > 0) {
      setSummaryCameraMode("end");
      setFollowUser(true);
      setError("");
      return;
    }
    const last = pointsRef.current[pointsRef.current.length - 1];
    const center = last ? ([last.lon, last.lat] as [number, number]) : await currentPosition({ requestPermission: true });
    if (!center) {
      setError("Waiting for a GPS fix. Move outside and try Re-center again.");
      return;
    }
    setFollowUser(true);
    setError("");
    if (phase !== "recording") {
      requestAnimationFrame(() => cameraRef.current?.easeTo({ center, zoom: 16, pitch: 45, duration: 650 }));
    }
  }, [phase]);

  const handleOpenGoogleMaps = useCallback(async () => {
    try {
      await Linking.openURL("https://www.google.com/maps");
    } catch {
      setError("Google Maps could not be opened. Your ADiV ride recording is still active.");
    }
  }, []);

  // Voice callouts: announce the next maneuver when close enough to it.
  useEffect(() => {
    if (phase !== "recording" || !guidanceActive || !planned || stepIndex >= planned.steps.length) return;
    if (planned.provider === "mapbox-navigation") return;
    const last = points[points.length - 1];
    if (!last) return;
    const step = planned.steps[stepIndex];
    if (metersToStep([last.lon, last.lat], step) <= SPEAK_DISTANCE_METERS) {
      if (announcedStepRef.current?.planned === planned && announcedStepRef.current.stepIndex === stepIndex) return;
      announcedStepRef.current = { planned, stepIndex };
      Speech.speak(step.text);
      const nextStepIndex = stepIndex + 1;
      setTimeout(() => {
        if (latestPlannedRef.current === planned) {
          setStepIndex((index) => Math.max(index, nextStepIndex));
        }
      }, 0);
    }
  }, [points, phase, guidanceActive, planned, stepIndex]);

  useEffect(() => {
    if (phase !== "recording" || !guidanceActive || planned?.provider !== "mapbox-navigation") return;
    const subscriptions = [
      addMapboxListener<{ instruction: string; stepDistanceRemaining: number }>("onRouteProgress", (progress) => {
        setMapboxProgress({ instruction: progress.instruction, distanceMeters: progress.stepDistanceRemaining });
        const matchingStep = planned.steps.findIndex((step) => step.text === progress.instruction);
        if (matchingStep >= 0) setStepIndex(matchingStep);
      }),
      addMapboxListener<{
        routeId: string;
        source: "offline" | "online" | "unknown";
        distanceMeters: number;
        durationSeconds: number;
        coordinates: [number, number][];
        steps: { text: string; distanceMeters: number; lon: number; lat: number }[];
      }>("onRouteChanged", (route) => {
        releaseMapboxRoute(planned.routeId);
        setPlanned((current) => current?.provider === "mapbox-navigation" ? {
          ...current,
          routeId: route.routeId,
          routeSource: route.source,
          coordinates: route.coordinates,
          distanceKm: route.distanceMeters / 1000,
          durationMinutes: route.durationSeconds / 60,
          steps: route.steps,
        } : current);
        setMapboxProgress(null);
        setStepIndex(0);
      }),
      addMapboxListener<{ offRoute: boolean }>("onOffRoute", ({ offRoute }) => {
        if (offRoute) setError("Mapbox reports that you are off route and is checking for a valid reroute.");
        else setError((message) => message.startsWith("Mapbox reports that you are off route") ? "" : message);
      }),
      addMapboxListener<{ waypointIndex: number; isFinalDestination: boolean }>("onArrival", ({ isFinalDestination }) => {
        if (!isFinalDestination) return;
        stopGuidance();
        setDestination(null);
        setPlanned(null);
        setRouteNeedsRefresh(false);
        void clearActiveRideRoute().catch(() => undefined);
        setMapboxProgress(null);
        setError("You have arrived. Guidance stopped; the same ride is still recording.");
      }),
      addMapboxListener<{ text: string }>("onVoiceInstruction", ({ text }) => {
        if (text.trim()) Speech.speak(text);
      }),
      addMapboxListener<{ message: string }>("onGuidanceError", ({ message }) => {
        stopGuidance();
        setFollowUser(true);
        setMapboxProgress(null);
        setError(message);
      }),
    ].filter((subscription): subscription is NonNullable<typeof subscription> => subscription !== null);

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [phase, guidanceActive, planned, stopGuidance]);

  useEffect(() => {
    if (phase !== "recording" || !guidanceActive || !destination || points.length === 0) return;
    if (planned?.provider === "mapbox-navigation") return;
    const last = points[points.length - 1];
    const destinationPoint = { lon: destination[0], lat: destination[1] };
    if (haversineMeters(last, destinationPoint) > 45) return;
    const arrivalTimer = setTimeout(() => {
      stopGuidance();
      setDestination(null);
      setPlanned(null);
      setRouteNeedsRefresh(false);
      void clearActiveRideRoute().catch(() => undefined);
      setStepIndex(0);
      setError("You have arrived. Guidance stopped; the same ride is still recording.");
    }, 0);
    return () => clearTimeout(arrivalTimer);
  }, [points, phase, guidanceActive, destination, stopGuidance, planned]);

  useEffect(() => {
    if (phase !== "recording" || !guidanceActive || !planned || !destination) {
      rerouteStateRef.current = { ...rerouteStateRef.current, consecutiveOffRouteFixes: 0 };
      return;
    }
    if (planned.provider === "mapbox-navigation") return;
    const last = points[points.length - 1];
    if (!last) return;
    const distance = distanceToRouteMeters([last.lon, last.lat], planned.coordinates);
    const decision = updateRerouteHysteresis(
      rerouteStateRef.current,
      distance,
      Date.now(),
      routeLoading || reroutingRef.current,
    );
    rerouteStateRef.current = decision.state;
    if (!decision.shouldReroute) return;

    reroutingRef.current = true;
    setRouteLoading(true);
    const request = new AbortController();
    rerouteAbortRef.current?.abort();
    rerouteAbortRef.current = request;
    void (async () => {
      const network = await Network.getNetworkStateAsync().catch(() => null);
      if (request.signal.aborted) return;
      const offlineOnly = network?.isConnected !== true || network.isInternetReachable === false;
      if (offlineOnly && !isMapboxAndroidReady()) {
        setError("You're off route. Offline rerouting needs Mapbox Navigation tiles; recording continues.");
        return;
      }
      const nextRoute = await planRoute([last.lon, last.lat], destination, { signal: request.signal, offlineOnly });
      if (request.signal.aborted) return;
      setPlanned(nextRoute);
      const savedRoute = await loadActiveRideRoute().catch(() => null);
      if (savedRoute) await saveActiveRideRoute({ ...savedRoute, planned: nextRoute }).catch(() => undefined);
      setMapboxProgress(null);
      setStepIndex(0);
      setError("");
    })()
      .catch(() => {
        if (!request.signal.aborted) setError("You're off route. The route could not be refreshed; check the network or installed offline routing tiles.");
      })
      .finally(() => {
        if (rerouteAbortRef.current === request) {
          rerouteAbortRef.current = null;
          reroutingRef.current = false;
          setRouteLoading(false);
        }
      });
  }, [points, phase, guidanceActive, planned, destination, routeLoading]);

  const nextStep = guidanceActive && planned && stepIndex < planned.steps.length
    ? planned.provider === "mapbox-navigation" && mapboxProgress?.instruction
      ? { ...planned.steps[stepIndex], text: mapboxProgress.instruction, distanceMeters: mapboxProgress.distanceMeters }
      : planned.steps[stepIndex]
    : null;

  const handleStart = useCallback(async () => {
    if (navigationFirst && (routeLoading || routeNeedsRefresh)) {
      setError("Wait for the route to finish updating before starting navigation.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      setNotificationUnavailable(!(await requestRideNotificationPermission()));
      const ride = await startRecording(navigationFirst ? "navigateAndRecord" : "recordOnly");
      setRideId(ride.id);
      setRideStartedAt(ride.startedAt);
      setRideEndedAt(null);
      setRideElapsedMs(ride.elapsedMs);
      setRideRunStartedAt(ride.runStartedAt);
      pointsRef.current = getTrackPoints();
      setPoints(pointsRef.current);
      const showPlannedRoute = navigationFirst && planned !== null;
      let beginGuidance = showPlannedRoute && (phase === "idle" || phase === "recovered" || resumeGuidanceAfterPauseRef.current);
      if (beginGuidance && planned?.provider === "mapbox-navigation" && planned.routeId) {
        try {
          await startMapboxGuidance(planned.routeId, planned.offlineOnly === true);
        } catch (guidanceError) {
          stopMapboxGuidance();
          beginGuidance = false;
          setError(`The ride is recording, but Mapbox guidance could not start: ${guidanceError instanceof Error ? guidanceError.message : "unknown error"}`);
        }
      }
      if (beginGuidance) setMapboxProgress(null);
      setGuidanceActive(beginGuidance);
      resumeGuidanceAfterPauseRef.current = false;
      setPlanning(false);
      setFollowUser(true);
      setPhase("recording");
      if (beginGuidance && planned) {
        setFullscreenMap(true);
        router.setParams({ fullscreen: "true" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start recording.");
    } finally {
      setBusy(false);
    }
  }, [navigationFirst, planned, phase, routeLoading, routeNeedsRefresh]);

  const handlePause = useCallback(async () => {
    routeAbortRef.current?.abort();
    rerouteAbortRef.current?.abort();
    resumeGuidanceAfterPauseRef.current = guidanceActive && planned !== null;
    stopGuidance();
    setMapboxProgress(null);
    const ride = await pauseRecording();
    if (ride) {
      setRideElapsedMs(ride.elapsedMs);
      setRideRunStartedAt(null);
    }
    setFullscreenMap(false);
    router.setParams({ fullscreen: undefined });
    setPhase("paused");
    // Points stay buffered — Start resumes into the same track with a new run.
  }, [guidanceActive, planned, stopGuidance]);

  const handleFinish = useCallback(async () => {
    stopGuidance();
    resumeGuidanceAfterPauseRef.current = false;
    setBusy(true);
    setError("");
    try {
      const ride = await finishRecording();
      if (!ride) throw new Error("No active ride was found to finish.");
      setRideId(ride.id);
      setRideStartedAt(ride.startedAt);
      setRideEndedAt(ride.endedAt ?? Date.now());
      setRideElapsedMs(ride.elapsedMs);
      setRideRunStartedAt(null);
      pointsRef.current = ride.points;
      setPoints(ride.points);
      setSummaryCameraMode("route");
      setFollowUser(true);
      const showSummaryMap = navigationFirst || showMap;
      setFullscreenMap(showSummaryMap);
      router.setParams({ fullscreen: showSummaryMap ? "true" : undefined });
      setPhase("summary");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish the ride.");
    } finally {
      setBusy(false);
    }
  }, [navigationFirst, showMap, stopGuidance]);

  const handleDiscard = useCallback(async () => {
    stopGuidance();
    releaseMapboxRoute(latestPlannedRef.current?.routeId);
    resumeGuidanceAfterPauseRef.current = false;
    await clearActiveRideRoute().catch(() => undefined);
    await discardRecording();
    pointsRef.current = [];
    setPoints([]);
    setRideId(null);
    setRideStartedAt(null);
    setRideEndedAt(null);
    setRideElapsedMs(0);
    setRideRunStartedAt(null);
    setStartOdometerInput("");
    setUpdateCurrentOdometer(false);
    setNotes("");
    setPlanned(null);
    setRouteNeedsRefresh(false);
    setDestination(null);
    setFollowUser(true);
    setFullscreenMap(false);
    router.setParams({ fullscreen: undefined });
    setPlanning(false);
    setStepIndex(0);
    setPhase("idle");
  }, [stopGuidance]);

  const handleSave = useCallback(async () => {
    if (!rideId || !rideStartedAt || !rideEndedAt) {
      setError("Ride details are incomplete. Resume and end the ride again before saving.");
      return;
    }
    const startOdometer = Number(startOdometerInput);
    if (!Number.isFinite(startOdometer) || startOdometer < 0) {
      setError("Enter the odometer reading from your dash before saving.");
      return;
    }
    setBusy(true);
    setError("");
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    try {
      const summary = buildRideSummaryPayload({
        clientRideId: rideId,
        startOdometer,
        points,
        startedAt: rideStartedAt,
        endedAt: rideEndedAt,
        elapsedMs: rideElapsedMs,
        updateCurrentOdometer,
        notes,
      });
      await saveRideSummary(rideId, summary);
      await clearActiveRideRoute().catch(() => undefined);
      stopGuidance();
      releaseMapboxRoute(latestPlannedRef.current?.routeId);
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      pointsRef.current = [];
      setPoints([]);
      setRideId(null);
      setRideStartedAt(null);
      setRideEndedAt(null);
      setRideElapsedMs(0);
      setRideRunStartedAt(null);
      setUpdateCurrentOdometer(false);
      setPlanned(null);
      setRouteNeedsRefresh(false);
      setDestination(null);
      setPlanning(false);
      setStepIndex(0);
      router.replace({ pathname: "/share/[rideId]", params: { rideId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the ride.");
    } finally {
      setBusy(false);
    }
  }, [points, rideId, rideStartedAt, rideEndedAt, rideElapsedMs, startOdometerInput, updateCurrentOdometer, notes, stopGuidance]);

  if (!ready) return <Page back><LoadingState label="Preparing the recorder…" /></Page>;

  const recording = phase === "recording";
  const activityShareOpen = Boolean(globalParams.rideId);
  const mapVisible = !activityShareOpen && (navigationFirst || showMap);
  const immersiveMap = mapVisible && fullscreenMap && (recording || phase === "summary");
  const usingMapbox = mapboxConfigured && isMapboxAndroidReady();
  const mapCameraMode = recording
    ? followUser ? "course" as const : "free" as const
    : phase === "summary" && followUser && summaryCameraMode === "end" && points.length > 0
      ? "center" as const
      : followUser && trackBounds
        ? "bounds" as const
        : followUser ? "follow" as const : "free" as const;
  const mapCenter = phase === "summary" && summaryCameraMode === "end" && points.length > 0
    ? [points[points.length - 1].lon, points[points.length - 1].lat] as [number, number]
    : null;
  const setMapFullscreen = (enabled: boolean) => {
    setFullscreenMap(enabled);
    router.setParams({ fullscreen: enabled ? "true" : undefined });
  };

  return (
    <Page
      back={!immersiveMap}
      immersive={immersiveMap}
      scroll={!immersiveMap}
      eyebrow="Ride recorder"
      title={navigationFirst ? "Navigate + Record" : "Record Only"}
      subtitle={recording
        ? navigationFirst ? `Ride recording is active with ${planned?.provider === "mapbox-navigation" ? "Mapbox" : "OSRM"} guidance.` : "Ride recording is active; navigation is off."
        : navigationFirst ? "Plan a route, then start navigation and recording together." : "Record your actual GPS route locally. A map is optional."}
    >
      {!immersiveMap && Platform.OS === "web" ? (
        <Banner title="Android only" body="GPS recording runs in the Android app. Open ADiV on your phone to record rides." />
      ) : null}
      {error && !immersiveMap ? (
        <Banner title="Recorder" body={error} tone="warning" />
      ) : null}
      {mapboxSetupError && mapVisible && !immersiveMap ? (
        <Banner title="Mapbox unavailable in this build" body={`${mapboxSetupError} The existing MapLibre map remains available.`} tone="warning" />
      ) : null}
      {recording && notificationUnavailable && !immersiveMap ? (
        <Banner
          title="Ride notification controls are disabled"
          body="Allow ADiV notifications in Android settings to see live ride metrics and Pause / End actions in the notification shade. GPS recording is still running."
          tone="warning"
        />
      ) : null}

      {planning && (!recording || !guidanceActive) && !immersiveMap ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "800" }}>Destination</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              paddingLeft: 12,
              paddingRight: 4,
            }}
          >
            <Search size={16} color={colors.mutedForeground} />
            <TextInput
              value={searchQuery}
              onChangeText={handleSearchInput}
              placeholder={pinMode ? "Pin mode — position the map, then confirm" : "Where to? Search a place…"}
              placeholderTextColor={colors.mutedForeground}
              style={{ flex: 1, minHeight: 48, color: colors.foreground }}
              autoCorrect={false}
              accessibilityLabel="Search destinations"
            />
            {searchQuery ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchSource(null);
                }}
                style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
          {searchResults.length > 0 ? (
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator
              style={{ maxHeight: 188, borderWidth: 1, borderColor: colors.border }}
            >
              {searchResults.map((result) => (
                <Pressable
                  key={`${result.lat.toFixed(5)}-${result.lon.toFixed(5)}-${result.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: routeLoading }}
                  disabled={routeLoading}
                  onPress={() => void choosePlace(result)}
                  style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 12, paddingVertical: 11, opacity: routeLoading ? 0.55 : 1 }}
                >
                  <Text style={{ color: colors.foreground, fontSize: 13 }} numberOfLines={1}>{result.label}</Text>
                  {result.detail ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>{result.detail}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View style={{ backgroundColor: colors.secondary, paddingHorizontal: 11, paddingVertical: 8, gap: 3 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
              {searchSource === "offline-only"
                ? `Offline OpenStreetMap search · ${offlineMap?.pack.name ?? "no offline pack installed"}`
                : offlineMap
                  ? `OpenStreetMap search · Photon + ${offlineMap.pack.name} offline pack`
                  : "OpenStreetMap search via Photon · internet required"}
            </Text>
            {searching ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Searching places…</Text> : null}
            {searchQuery.trim().length >= 2 && searchResults.length === 0 && !searching ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                {searchSource === "offline-only"
                  ? offlineMap
                    ? "No match in this offline pack. Pin the map or enter coordinates. Online search is off while disconnected."
                    : "No offline pack is installed. Connect to the internet, pin the map, or enter coordinates."
                  : searchSource === "unavailable"
                    ? "Online search could not connect. Check internet or install a pack; pin the map or enter coordinates as a fallback."
                    : searchSource === "offline"
                      ? "No match in this offline pack. Pin the map or enter coordinates."
                      : "No mapped match. Try a shorter place/street name, or pin the map / enter coordinates."}
              </Text>
            ) : null}
            {searchSource === "offline-only" ? <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Offline search sends no place-search request.</Text> : null}
          </View>
        </View>
      ) : null}

      {phase !== "idle" && !immersiveMap ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <StatCard label="DISTANCE" value={refreshingRide ? "Updating…" : km(stats.distanceKm)} detail="GPS estimate" />
          <StatCard
            label="RIDE TIME"
            value={refreshingRide ? "Updating…" : `${Math.floor(stats.elapsedMs / 60000)}m ${Math.floor((stats.elapsedMs % 60000) / 1000)}s`}
            detail="Active recording; pauses excluded"
          />
          <StatCard label="AVG SPEED" value={refreshingRide ? "Updating…" : `${stats.avgSpeedKmh.toFixed(1)} km/h`} detail="Distance over ride time" />
          <StatCard label="MAX SPEED" value={refreshingRide ? "Updating…" : stats.maxSpeedKmh > 0 ? `${stats.maxSpeedKmh.toFixed(1)} km/h` : "—"} detail="Filtered GPS fixes" />
        </View>
      ) : null}

      {/* Record Only can run without initializing a map view. */}
      {mapVisible ? <View
        style={immersiveMap
          ? { flex: 1, minHeight: 0, overflow: "hidden" }
          : { height: recording ? (planned ? 460 : 400) : 320, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}
      >
        {!usingMapbox && offlineMap === undefined ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.card }}>
            <Text style={{ color: colors.mutedForeground }}>Checking for an installed offline map…</Text>
          </View>
        ) : (
          <RideMap
            ref={mapRef}
            cameraRef={cameraRef}
            provider={usingMapbox ? "mapbox" : "maplibre"}
            styleURL={MAPBOX_STYLE_URI}
            mapLibreStyle={offlineMap?.style ?? getMapStyle(resolved === "dark" ? "dark" : "light")}
            style={{ flex: 1 }}
            cameraMode={mapCameraMode}
            planned={Boolean(planned)}
            bounds={trackBounds}
            center={mapCenter}
            actualRoute={routeGeoJSON}
            plannedRoute={planned ? plannedGeoJSON : undefined}
            destination={destination}
            destinationColor={colors.primary}
            onLongPress={planning && (!recording || !guidanceActive) ? (event) => void handleLongPress(event) : undefined}
            onUserInteraction={() => setFollowUser(false)}
          />
        )}

        {recording && nextStep ? (
          <Animated.View
            key={`${planned?.routeId ?? "route"}-${stepIndex}`}
            entering={reduceMotion ? undefined : FadeIn.duration(180)}
            style={{ position: "absolute", top: 10, left: 10, right: 10, minHeight: 88, justifyContent: "center", backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, gap: 2 }}
          >
            <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "800", opacity: 0.9 }}>
              IN {Math.max(0, Math.round(planned?.provider === "mapbox-navigation" && mapboxProgress
                ? mapboxProgress.distanceMeters
                : metersToStep(points.length > 0 ? [points[points.length - 1].lon, points[points.length - 1].lat] : [0, 0], nextStep)))} M
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 19, fontWeight: "900" }} numberOfLines={2}>{nextStep.text}</Text>
          </Animated.View>
        ) : null}

        {immersiveMap && error ? (
          <View style={{ position: "absolute", top: recording && nextStep ? 94 : 10, left: 10, right: 10 }}>
            <Banner title="Navigation" body={error} tone="warning" />
          </View>
        ) : null}

        {immersiveMap ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit full-screen map"
            onPress={() => setMapFullscreen(false)}
            style={{ position: "absolute", top: recording && nextStep ? 94 : 10, right: 10, width: 46, height: 46, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 24, elevation: 4 }}
          >
            <Minimize2 size={19} color={colors.foreground} />
          </Pressable>
        ) : phase === "summary" || (recording && navigationFirst && planned) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open full-screen map"
            onPress={() => setMapFullscreen(true)}
            style={{ position: "absolute", top: 10, right: 10, width: 46, height: 46, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 24, elevation: 4 }}
          >
            <Expand size={19} color={colors.foreground} />
          </Pressable>
        ) : null}

        {recording || phase === "summary" || !followUser ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Re-center on my location"
            onPress={() => void handleRecenter()}
            style={{ position: "absolute", bottom: immersiveMap ? 174 : 12, ...(usingMapbox ? { right: 12 } : { left: 12 }), flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 11, elevation: 4 }}
          >
            <Navigation size={18} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontWeight: "800" }}>Re-center</Text>
          </Pressable>
        ) : null}

        {immersiveMap && recording ? (
          <View style={{ position: "absolute", bottom: 12, left: 10, right: 10, padding: 12, gap: 8, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, elevation: 5 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "900" }}>{km(stats.distanceKm)}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  {refreshingRide ? "Updating ride stats…" : `${Math.floor(stats.elapsedMs / 60000)} min · avg ${stats.avgSpeedKmh.toFixed(1)} km/h · max ${stats.maxSpeedKmh > 0 ? `${stats.maxSpeedKmh.toFixed(1)} km/h` : "—"}`}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {!navigationFirst ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Open Google Maps while keeping ride recording active" onPress={() => void handleOpenGoogleMaps()} style={{ minWidth: 52, minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }}>
                    <ExternalLink size={18} color={colors.foreground} />
                  </Pressable>
                ) : null}
                {navigationFirst && guidanceActive ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Stop guidance and keep ride recording active" onPress={handleStopGuidance} style={{ minWidth: 52, minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }}>
                    <X size={18} color={colors.foreground} />
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel="Pause recording" onPress={() => void handlePause()} style={{ minWidth: 52, minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }}>
                  <Square size={18} color={colors.foreground} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="End ride" onPress={() => void handleFinish()} disabled={busy} style={{ minWidth: 52, minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.danger, opacity: busy ? 0.55 : 1 }}>
                  <Flag size={18} color="#ffffff" />
                </Pressable>
              </View>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
              {planned
                ? planned.provider === "mapbox-navigation"
                  ? `Mapbox ${planned.routeSource ?? "unknown"} route · driving profile; motorcycle suitability is unverified.`
                  : "Online OSRM route · driving profile; motorcycle suitability is unverified."
                : usingMapbox ? "Mapbox map · actual recorded GPS track" : "Recorded GPS track · MapLibre map"}
              {offlineMap && !usingMapbox ? ` · ${offlineMap.pack.attribution}` : ""}
            </Text>
          </View>
        ) : null}

        {immersiveMap && phase === "summary" ? (
          <View style={{ position: "absolute", bottom: 12, left: 10, right: 10, padding: 12, gap: 8, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, elevation: 5 }}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "900" }}>Ride ended · {km(stats.distanceKm)}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {Math.floor(stats.elapsedMs / 60000)} min · avg {stats.avgSpeedKmh.toFixed(1)} km/h · max {stats.maxSpeedKmh > 0 ? `${stats.maxSpeedKmh.toFixed(1)} km/h` : "—"}
            </Text>
            <AppButton label="Return to ride summary" variant="outline" compact onPress={() => setMapFullscreen(false)} />
          </View>
        ) : null}

        {/* Pin mode crosshair + confirm */}
        {planning && pinMode ? (
          <>
            <View
              pointerEvents="none"
              style={{ position: "absolute", top: "50%", left: "50%", marginTop: -16, marginLeft: -16 }}
            >
              <MapPin size={32} color="#e62025" />
            </View>
            <View style={{ position: "absolute", bottom: 14, left: 10, right: 10 }}>
              <AppButton label="Set destination here" onPress={() => void handlePinHere()} icon={<MapPin size={17} color="#ffffff" />} />
            </View>
          </>
        ) : null}
      </View> : (
        <AppButton label="Show optional map" variant="outline" onPress={() => setShowMap(true)} icon={<Eye size={16} color={colors.primary} />} />
      )}

      {mapVisible && !immersiveMap ? <View style={{ gap: 4 }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "700" }}>
          {usingMapbox
            ? "Mapbox Streets · Android"
            : offlineMap
              ? `Offline MapLibre map · ${offlineMap.pack.name} · OSM data ${offlineMap.pack.dataDate} · coverage ${offlineMap.pack.coverage.map((coordinate) => coordinate.toFixed(2)).join(", ")}`
              : "Online MapLibre map · CARTO · internet required"}
        </Text>
        {!usingMapbox ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            {offlineMap?.pack.attribution ?? "Map data attribution is shown with the online map style."}
          </Text>
        ) : null}
      </View> : null}
      {mapVisible && !immersiveMap && Platform.OS === "android" && !offlineMap ? (
        <AppButton label="Manage offline map packs" variant="outline" onPress={() => router.push("/offline-packs")} icon={<MapPin size={16} color={colors.primary} />} />
      ) : null}
      {mapVisible && !navigationFirst && !immersiveMap ? (
        <AppButton label="Hide optional map" variant="outline" onPress={() => { setShowMap(false); setFullscreenMap(false); router.setParams({ fullscreen: undefined }); }} icon={<EyeOff size={16} color={colors.primary} />} />
      ) : null}

      {phase === "idle" || phase === "paused" || phase === "recovered" ? (
        <>
          {points.length > 0 ? (
            <View style={{ gap: 10 }}>
              {phase === "recovered" ? (
                <Banner
                  title="Recording interrupted"
                  body={navigationFirst
                    ? "GPS points are restored. The saved route returns when available; the missing GPS interval stays disconnected."
                    : "Your last saved GPS point was restored. The missing interval is not connected to the next point. Resume, end, or discard this ride."}
                  tone="warning"
                />
              ) : null}
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>
                {phase === "recovered" ? "Recovered" : "Paused"} · {km(trackDistanceKm(points))} recorded so far
              </Text>
              <AppButton
                label={routeLoading || routeNeedsRefresh ? "Updating route…" : "Resume recording"}
                onPress={() => void handleStart()}
                busy={busy || routeLoading}
                disabled={routeLoading || routeNeedsRefresh}
                icon={<Disc size={17} color="#ffffff" />}
              />
              <AppButton label="End ride" variant="outline" onPress={() => void handleFinish()} busy={busy} icon={<Flag size={17} color={colors.primary} />} />
              <AppButton label="Discard recording" variant="danger" onPress={() => void handleDiscard()} busy={busy} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {navigationFirst ? (
                <>
                  <AppButton
                    label={routeLoading || routeNeedsRefresh ? "Updating route…" : planned ? "Start Navigate + Record" : "Choose a destination to continue"}
                    onPress={() => void handleStart()}
                    busy={busy || routeLoading}
                    disabled={!planned || routeLoading || routeNeedsRefresh}
                    icon={<Disc size={17} color="#ffffff" />}
                  />
                  <AppButton
                    label={planning ? "Cancel route planning" : "Plan an online route"}
                    variant="outline"
                    onPress={() => {
                      setPlanning(!planning);
                      setDestination(null);
                      setPlanned(null);
                      setRouteNeedsRefresh(false);
                      void clearActiveRideRoute().catch(() => undefined);
                      setError("");
                    }}
                    icon={<Navigation size={16} color={colors.primary} />}
                  />
                </>
              ) : (
                <AppButton label="Start Record Only" onPress={() => void handleStart()} busy={busy} icon={<Disc size={17} color="#ffffff" />} />
              )}
              {navigationFirst && planning ? (
                <>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 19 }}>
                    {destination
                      ? "Long-press again or search to move the destination."
                      : "Search a place, long-press the map, or pin the map center — then start your guided ride."}
                  </Text>
                  <AppButton
                    label={pinMode ? "Exit pin mode" : "Pin on map"}
                    variant="outline"
                    onPress={() => setPinMode(!pinMode)}
                    icon={<MapPin size={16} color={colors.primary} />}
                  />
                  <AppButton
                    label={showCoordinateEntry ? "Hide coordinate entry" : "Enter coordinates"}
                    variant="outline"
                    onPress={() => setShowCoordinateEntry(!showCoordinateEntry)}
                  />
                  {showCoordinateEntry ? (
                    <>
                      <Field
                        label="Coordinates (latitude, longitude)"
                        value={coordinateText}
                        onChangeText={setCoordinateText}
                        placeholder="7.0731, 125.6128"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <AppButton label="Use these coordinates" variant="secondary" onPress={() => void handleCoordinateEntry()} />
                    </>
                  ) : null}
                </>
              ) : null}
              {routeLoading ? <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Planning route…</Text> : null}
              {planned ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>
                    Route: {km(planned.distanceKm)} · about {Math.round(planned.durationMinutes)} min · {planned.steps.length} turns
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {planned.provider === "mapbox-navigation"
                      ? `Mapbox ${planned.routeSource ?? "unknown"} route · driving profile. Motorcycle road suitability is unverified; check local signs and road rules.`
                      : "Online OSRM route · driving profile · requires internet. It refreshes after 3 GPS fixes over 120 m off route. Motorcycle access may be inaccurate; check local signs and road rules."}
                  </Text>
                </View>
              ) : null}
              <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 19 }}>
                Recording keeps a persistent notification so tracking survives screen-off. Enter the
                odometer reading when you save — GPS distance is measured from your actual route.
              </Text>
            </View>
          )}
        </>
      ) : null}

      {recording && navigationFirst && !immersiveMap ? (
        <View style={{ gap: 8 }}>
          {guidanceActive ? (
            <AppButton label="Stop guidance · keep recording" variant="outline" onPress={handleStopGuidance} icon={<X size={16} color={colors.primary} />} />
          ) : planned ? (
            <AppButton label="Start guidance" onPress={handleResumeGuidance} busy={routeLoading} icon={<Navigation size={16} color="#ffffff" />} />
          ) : null}
          <AppButton label={planned ? "Plan next leg" : "Plan a route"} variant="outline" onPress={handlePlanNextLeg} icon={<MapPin size={16} color={colors.primary} />} />
        </View>
      ) : null}

      {recording && !immersiveMap ? (
        <View style={{ gap: 8 }}>
          {!navigationFirst ? <AppButton label="Open Google Maps" variant="outline" onPress={() => void handleOpenGoogleMaps()} icon={<ExternalLink size={16} color={colors.primary} />} /> : null}
          <AppButton label="Pause tracking" variant="outline" onPress={() => void handlePause()} icon={<Square size={17} color={colors.primary} />} />
          <AppButton label="End ride" variant="danger" onPress={() => void handleFinish()} busy={busy} icon={<Flag size={17} color="#ffffff" />} />
        </View>
      ) : null}

      {phase === "summary" && !immersiveMap ? (
        <View style={{ gap: 12 }}>
          <Banner
            title="Ride finished"
            body={`${km(trackDistanceKm(points))} tracked across ${points.length} GPS points. Choose whether to add this GPS estimate to the bike's current odometer.`}
            tone="success"
          />
          <Field
            label="Odometer before this ride (km) *"
            value={startOdometerInput}
            onChangeText={setStartOdometerInput}
            keyboardType="decimal-pad"
            placeholder={bike ? String(Math.round(bike.currentOdometer)) : "0"}
          />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            Estimated end reading: {startOdometerInput ? km(Number(startOdometerInput) + trackDistanceKm(points)) : "—"} (start + GPS distance).
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: updateCurrentOdometer }}
            accessibilityLabel="Add GPS ride distance to the current odometer"
            onPress={() => setUpdateCurrentOdometer((value) => !value)}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 12 }}
          >
            <View style={{ width: 22, height: 22, borderWidth: 1.5, borderColor: updateCurrentOdometer ? colors.primary : colors.border, backgroundColor: updateCurrentOdometer ? colors.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
              {updateCurrentOdometer ? <Check size={15} color="#ffffff" strokeWidth={3} /> : null}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "800" }}>Add GPS distance to current odometer</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
                {updateCurrentOdometer
                  ? "The bike odometer will advance by this GPS estimate when the ride syncs."
                  : "Off: save the ride distance, but keep the bike odometer unchanged until you update it at refueling or service."}
              </Text>
            </View>
          </Pressable>
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
          <AppButton label="Save ride" onPress={() => void handleSave()} busy={busy} icon={<Flag size={17} color="#ffffff" />} />
          <AppButton label="Discard ride" variant="danger" onPress={() => void handleDiscard()} busy={busy} />
        </View>
      ) : null}
    </Page>
  );
}
