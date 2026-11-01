import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Map as MapView, Camera, GeoJSONSource, Layer, UserLocation } from "@maplibre/maplibre-react-native";
import * as Speech from "expo-speech";
import { Disc, Flag, Navigation, Square } from "lucide-react-native";
import { api } from "@/lib/api";
import { AppButton, Banner, Field, LoadingState, Page, StatCard } from "@/components/ui";
import { km, php } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";
import { OSM_STYLE, ROUTE_LINE_PAINT, boundsFor, routeFeatureCollection } from "@/lib/map-style";
import { encodePolyline, trackDistanceKm, type TrackPoint } from "@/lib/shared";
import { metersToStep, planRoute, SPEAK_DISTANCE_METERS, type PlannedRoute } from "@/lib/navigation";
import {
  clearActiveRide,
  currentPosition,
  discardRecording,
  getTrackPoints,
  loadActiveRide,
  pauseRecording,
  startRecording,
  subscribeToTrack,
} from "@/lib/ride-tracker";

type Phase = "idle" | "recording" | "summary";

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
  const { colors } = useAppTheme();
  const bike = useQuery(api.bike.getBike);
  const logRide = useMutation(api.rides.logRide);

  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [startOdometerInput, setStartOdometerInput] = useState("");
  const [notes, setNotes] = useState("");

  // Guided navigation: long-press the map to plan a route, voice callouts
  // announce maneuvers as you approach them.
  const [planning, setPlanning] = useState(false);
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [planned, setPlanned] = useState<PlannedRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // The tracker buffer is module-level; mirror it into state for rendering.
  const pointsRef = useRef<TrackPoint[]>([]);

  useEffect(() => {
    void (async () => {
      const restored = await loadActiveRide();
      if (restored) {
        pointsRef.current = restored.points;
        setPoints(restored.points);
        setPhase("summary");
        if (bike) setStartOdometerInput(String(Math.round(bike.currentOdometer)));
      } else if (Platform.OS === "web") {
        setError("Ride recording needs the Android app. Open ADiV on your phone to record.");
      }
      setReady(true);
    })();
  }, [bike]);

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
    const startedAt = points[0]?.ts ?? now;
    const distanceKm = trackDistanceKm(points);
    const elapsedMs = Math.max(now - startedAt, 0);
    const hours = elapsedMs / MS_PER_HOUR;
    const speeds = points.map((p) => p.speed).filter((s): s is number => typeof s === "number" && s >= 0);
    const maxSpeedKmh = speeds.length > 0 ? Math.max(...speeds) * 3.6 : 0;
    const avgSpeedKmh = hours > 0 ? distanceKm / hours : 0;
    return { distanceKm, elapsedMs, maxSpeedKmh, avgSpeedKmh };
  }, [points, now]);

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

  const handleLongPress = useCallback(
    async (event: { nativeEvent: { lngLat: [number, number] } }) => {
      if (!planning || phase === "recording") return;
      const to = event.nativeEvent.lngLat;
      setDestination(to);
      setRouteLoading(true);
      setError("");
      try {
        const last = pointsRef.current[pointsRef.current.length - 1];
        const from = last ? ([last.lon, last.lat] as [number, number]) : await currentPosition();
        if (!from) {
          setError("No GPS fix yet — step outside and try again.");
          return;
        }
        const route = await planRoute(from, to);
        setPlanned(route);
        setStepIndex(0);
      } catch (e) {
        setPlanned(null);
        setError(e instanceof Error ? e.message : "Could not plan the route.");
      } finally {
        setRouteLoading(false);
      }
    },
    [planning, phase],
  );

  // Voice callouts: announce the next maneuver when close enough to it.
  useEffect(() => {
    if (phase !== "recording" || !planned || stepIndex >= planned.steps.length) return;
    const last = points[points.length - 1];
    if (!last) return;
    const step = planned.steps[stepIndex];
    if (metersToStep([last.lon, last.lat], step) <= SPEAK_DISTANCE_METERS) {
      Speech.speak(step.text);
      setStepIndex((index) => index + 1);
    }
  }, [points, phase, planned, stepIndex]);

  const nextStep =
    planned && stepIndex < planned.steps.length ? planned.steps[stepIndex] : null;

  const handleStart = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      await startRecording();
      pointsRef.current = getTrackPoints();
      setPoints(pointsRef.current);
      setPhase("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start recording.");
    } finally {
      setBusy(false);
    }
  }, []);

  const handlePause = useCallback(async () => {
    await pauseRecording();
    setPhase("idle");
    // Points stay buffered — Start resumes into the same track with a new run.
  }, []);

  const handleDiscard = useCallback(async () => {
    Speech.stop();
    await discardRecording();
    pointsRef.current = [];
    setPoints([]);
    setStartOdometerInput("");
    setNotes("");
    setPlanned(null);
    setDestination(null);
    setPlanning(false);
    setStepIndex(0);
    setPhase("idle");
  }, []);

  const handleSave = useCallback(async () => {
    if (points.length < 2) {
      setError("Not enough GPS points recorded to save this ride.");
      return;
    }
    const startOdometer = Number(startOdometerInput);
    if (!Number.isFinite(startOdometer) || startOdometer < 0) {
      setError("Enter the odometer reading from your dash before saving.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const trackedDistance = trackDistanceKm(points);
      const first = points[0];
      const last = points[points.length - 1];
      const speeds = points.map((p) => p.speed).filter((s): s is number => typeof s === "number" && s >= 0);
      const endOdometer = startOdometer + trackedDistance;
      await logRide({
        startOdometer,
        endOdometer,
        date: first.ts,
        startAt: first.ts,
        endAt: last.ts,
        source: "gps",
        route: encodePolyline(points.map((p) => [p.lon, p.lat])),
        trackedDistance,
        maxSpeedKmh: speeds.length > 0 ? Math.max(...speeds) * 3.6 : undefined,
        notes: notes.trim() || undefined,
      });
      await clearActiveRide();
      Speech.stop();
      pointsRef.current = [];
      setPoints([]);
      setPlanned(null);
      setDestination(null);
      setPlanning(false);
      setStepIndex(0);
      Alert.alert("Ride saved!", "Your GPS route was attached to this ride.");
      router.replace("/rides");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the ride.");
    } finally {
      setBusy(false);
    }
  }, [points, startOdometerInput, notes, logRide]);

  if (!ready) return <Page back><LoadingState label="Preparing the recorder…" /></Page>;

  const recording = phase === "recording";

  return (
    <Page back eyebrow="Ride recorder" title="Record ride" subtitle={recording ? "Tracking in the background — keep the phone mounted." : "GPS-tracked rides with your route on a map."}>
      {Platform.OS === "web" ? (
        <Banner title="Android only" body="GPS recording runs in the Android app. Open ADiV on your phone to record rides." />
      ) : null}
      {recording && nextStep ? (
        <Banner
          title={`In ${Math.round(metersToStep(points.length > 0 ? [points[points.length - 1].lon, points[points.length - 1].lat] : [0, 0], nextStep))} m`}
          body={nextStep.text}
          tone="success"
        />
      ) : null}
      {error ? (
        <Banner title="Recorder" body={error} tone="warning" />
      ) : null}

      {phase !== "idle" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <StatCard label="DISTANCE" value={km(stats.distanceKm)} detail="GPS measured" />
          <StatCard
            label="MOVING TIME"
            value={`${Math.floor(stats.elapsedMs / 60000)}m ${Math.floor((stats.elapsedMs % 60000) / 1000)}s`}
            detail="Since first GPS fix"
          />
          <StatCard label="AVG SPEED" value={`${stats.avgSpeedKmh.toFixed(1)} km/h`} detail="Over elapsed time" />
          <StatCard label="MAX SPEED" value={`${stats.maxSpeedKmh.toFixed(1)} km/h`} detail="GPS reported" />
        </View>
      ) : null}

      {points.length >= 2 ? (
        <View style={{ height: 280, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          <MapView
            mapStyle={OSM_STYLE}
            style={{ flex: 1 }}
            onLongPress={planning && phase !== "recording" ? (event) => void handleLongPress(event) : undefined}
          >
            {recording ? (
              <Camera trackUserLocation="default" zoom={16} />
            ) : (
              <Camera
                bounds={boundsFor(points.map((p) => [p.lon, p.lat]))}
                padding={{ top: 40, right: 40, bottom: 40, left: 40 }}
              />
            )}
            <GeoJSONSource id="routeSource" data={routeGeoJSON}>
              <Layer id="routeLine" type="line" paint={ROUTE_LINE_PAINT} />
            </GeoJSONSource>
            {planned ? (
              <GeoJSONSource id="plannedSource" data={plannedGeoJSON}>
                <Layer
                  id="plannedLine"
                  type="line"
                  paint={{ "line-color": "#f59e0b", "line-width": 4, "line-dasharray": [2, 2] }}
                />
              </GeoJSONSource>
            ) : null}
            {recording ? <UserLocation /> : null}
          </MapView>
        </View>
      ) : null}

      {phase === "idle" ? (
        <>
          {points.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>
                Paused · {km(trackDistanceKm(points))} recorded so far
              </Text>
              <AppButton label="Resume recording" onPress={() => void handleStart()} busy={busy} icon={<Disc size={17} color="#ffffff" />} />
              <AppButton label="Discard recording" variant="danger" onPress={() => void handleDiscard()} busy={busy} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <AppButton label="Start recording" onPress={() => void handleStart()} busy={busy} icon={<Disc size={17} color="#ffffff" />} />
              <AppButton
                label={planning ? "Cancel route planning" : "Plan a route (voice navigation)"}
                variant="outline"
                onPress={() => {
                  setPlanning(!planning);
                  setDestination(null);
                  setPlanned(null);
                  setError("");
                }}
                icon={<Navigation size={16} color={colors.primary} />}
              />
              {planning ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 19 }}>
                  {destination
                    ? "Long-press again to move the destination."
                    : "Long-press the map to drop a destination — the route is planned over free OSRM routing."}
                </Text>
              ) : null}
              {routeLoading ? <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Planning route…</Text> : null}
              {planned ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>
                    Route: {km(planned.distanceKm)} · about {Math.round(planned.durationMinutes)} min · {planned.steps.length} turns
                  </Text>
                  <AppButton
                    label="Start guided ride"
                    onPress={() => void handleStart()}
                    busy={busy}
                    icon={<Disc size={17} color="#ffffff" />}
                  />
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    Turns are announced aloud as you approach them (routing by OSRM).
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

      {recording ? (
        <AppButton label="Pause tracking" variant="danger" onPress={() => void handlePause()} icon={<Square size={17} color="#ffffff" />} />
      ) : null}

      {phase === "summary" ? (
        <View style={{ gap: 12 }}>
          <Banner
            title="Ride finished"
            body={`${km(trackDistanceKm(points))} tracked across ${points.length} GPS points. Enter the odometer reading from your dash, then save.`}
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
            End odometer will be {startOdometerInput ? km(Number(startOdometerInput) + trackDistanceKm(points)) : "—"} (start + GPS distance).
          </Text>
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
          <AppButton label="Save ride" onPress={() => void handleSave()} busy={busy} icon={<Flag size={17} color="#ffffff" />} />
          <AppButton label="Discard ride" variant="danger" onPress={() => void handleDiscard()} busy={busy} />
        </View>
      ) : null}
    </Page>
  );
}
