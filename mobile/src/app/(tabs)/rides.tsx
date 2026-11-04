import { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { router, useFocusEffect } from "expo-router";
import { useMutation } from "convex/react";
import { Disc, Navigation, Pencil, Play, Trash2 } from "lucide-react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { api, type Id } from "@/lib/api";
import { AppButton, Card, EmptyState, Page, SectionTitle } from "@/components/ui";
import { dateLabel, km, rideTimeLabel } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";
import { deleteSavedLocalRide, listSavedLocalRides } from "@/lib/local-ride-store";
import { RIDE_MODES, type ActiveRideState, type LocalRideRecord, type RideMode } from "@/lib/ride-model";
import { getActiveRideMode, loadActiveRide, reconcileActiveRecording } from "@/lib/ride-tracker";
import { trackDistanceKm } from "../../../../lib/geo";
import { shareLocalRideAsGpx } from "@/lib/gpx-export";
import { useShareSafeQuery } from "@/lib/share-safe-query";

type DeleteTarget = {
  kind: "cloud" | "sample";
  id: string;
  title: string;
  detail: string;
};

function averageSpeedKmh(ride: LocalRideRecord): number {
  const elapsedMs = ride.elapsedMs ?? ride.summary.durationMinutes * 60_000;
  return elapsedMs > 0 ? ride.summary.trackedDistance / (elapsedMs / 3_600_000) : 0;
}

export default function RidesScreen() {
  const rides = useShareSafeQuery(api.rides.getRides, { limit: 1000 });
  const deleteRide = useMutation(api.rides.deleteRide);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localRides, setLocalRides] = useState<LocalRideRecord[]>([]);
  const [activeRide, setActiveRide] = useState<ActiveRideState | null>(null);
  const [activeMode, setActiveMode] = useState<RideMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [exportingRideId, setExportingRideId] = useState<string | null>(null);
  const [gpxError, setGpxError] = useState("");
  const { colors } = useAppTheme();

  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([listSavedLocalRides(100), reconcileActiveRecording().catch(() => loadActiveRide()), getActiveRideMode()]).then(([records, activeState, mode]) => {
      if (!active) return;
      setLocalRides(records);
      setActiveRide(activeState);
      setActiveMode(mode);
    }).catch(() => {
      if (!active) return;
      setLocalRides([]);
      setActiveRide(null);
      setActiveMode(null);
    });
    return () => { active = false; };
  }, []));

  function confirmDelete(target: DeleteTarget) {
    setDeleteError("");
    setDeleteTarget(target);
  }

  async function performConfirmedDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeletingId(target.id);
    setDeleteError("");
    try {
      if (target.kind === "cloud") {
        await deleteRide({ rideId: target.id as Id<"rides"> });
      } else {
        await deleteSavedLocalRide(target.id);
        setLocalRides(await listSavedLocalRides(100));
      }
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete this item. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function exportGpx(ride: LocalRideRecord) {
    setExportingRideId(ride.id);
    setGpxError("");
    try {
      await shareLocalRideAsGpx(ride);
    } catch (error) {
      setGpxError(error instanceof Error ? error.message : "Could not export this GPS track.");
    } finally {
      setExportingRideId(null);
    }
  }

  function openActivityShare(rideId: string) {
    setGpxError("");
    router.push({ pathname: "/share/[rideId]", params: { rideId } });
  }

  const cloudRides = rides ?? [];
  const cloudClientIds = new Set(cloudRides.map((ride) => ride.clientRideId).filter((id): id is string => Boolean(id)));
  const localOnly = localRides.filter((ride) => !cloudClientIds.has(ride.id));
  const personalLocalOnly = localOnly.filter((ride) => !ride.demoMode);
  const rideCount = cloudRides.length + personalLocalOnly.length;
  const activeModeLabel = activeMode === "navigateAndRecord" ? "Navigate + Record" : "Record Only";
  const activeRideStatus = activeRide?.status === "recording"
    ? "Recording now"
    : activeRide?.status === "completed"
      ? "Ride ended · summary not saved"
      : activeRide?.interrupted
        ? "Recovered after the app stopped"
        : "Paused on this device";

  return (
    <Page eyebrow="Your rides" title="Rides" subtitle={`${rideCount} ${rideCount === 1 ? "ride" : "rides"} logged`}>
      {activeRide ? (
        <Card style={{ padding: 0, overflow: "hidden", borderColor: colors.primary }}>
          <View style={{ height: 4, backgroundColor: colors.primary }} />
          <View style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
              <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}14` }}>
                <Disc size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 16 }}>{activeModeLabel}</Text>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>{activeRideStatus}</Text>
              </View>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>
              {km(trackDistanceKm(activeRide.points))} recorded · {Math.floor(activeRide.elapsedMs / 60_000)} min · GPS points remain on this device
            </Text>
            {activeRide.interrupted && activeMode === "navigateAndRecord" ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>The saved track is recoverable. Choose a destination again to restart guidance.</Text>
            ) : null}
            <AppButton
              label={activeRide.status === "recording" ? "Return to active ride" : activeRide.status === "completed" ? "Open ride summary" : "Resume this ride"}
              onPress={() => router.push({ pathname: "/record", params: { mode: activeMode ?? "recordOnly" } })}
              icon={<Play size={16} color="#ffffff" />}
            />
          </View>
        </Card>
      ) : null}

      {/* Ride hub: make the two supported recording modes easy to distinguish. */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ padding: 16, gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 17 }}>Start a ride</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>Choose how you want to ride. Both modes save the same local GPS track.</Text>
            {activeRide ? <Text style={{ color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Resume or save the active ride above before starting another.</Text> : null}
          </View>
          <View style={{ padding: 12, gap: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Navigation size={18} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 15 }}>Navigate + Record</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>Choose a destination, preview the route, then start guidance and recording together.</Text>
            <AppButton
              label="Plan a guided ride"
              onPress={() => router.push({ pathname: "/record", params: { mode: RIDE_MODES[1] } })}
              disabled={Boolean(activeRide)}
              icon={<Navigation size={17} color="#ffffff" />}
            />
          </View>
          <View style={{ padding: 12, gap: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Disc size={18} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 15 }}>Record Only</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>Record your ride without a destination or ADiV navigation session. A map is optional.</Text>
            <AppButton label="Start recording" onPress={() => router.push({ pathname: "/record", params: { mode: RIDE_MODES[0] } })} disabled={Boolean(activeRide)} icon={<Disc size={17} color="#ffffff" />} />
          </View>
          <AppButton
            label="Log manually instead"
            variant="outline"
            disabled={Boolean(activeRide)}
            onPress={() => router.push({ pathname: "/log/[type]", params: { type: "ride" } })}
            icon={<Pencil size={16} color={colors.primary} />}
          />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>Forgot to record, or low battery? A manual entry still updates the bike odometer.</Text>
        </View>
      </Card>

      <SectionTitle title="All rides" />
      {gpxError ? <Text style={{ color: colors.danger, fontSize: 13 }}>{gpxError}</Text> : null}
      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Swipe left to edit · swipe right to delete</Text>
      {rides === undefined ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Cloud rides are unavailable. Saved local tracks remain available below.</Text> : null}
      {cloudRides.map((ride) => {
        const localTrack = ride.clientRideId ? localRides.find((local) => local.id === ride.clientRideId) : undefined;
        return (
        <ReanimatedSwipeable
          key={ride._id}
          friction={2}
          leftThreshold={48}
          rightThreshold={48}
          overshootLeft={false}
          overshootRight={false}
          renderLeftActions={() => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete ride"
              onPress={() => confirmDelete({ kind: "cloud", id: ride._id, title: `${km(ride.distance)} ride`, detail: `${dateLabel(ride.date)} · cloud ride summary` })}
              disabled={deletingId === ride._id}
              style={{ width: 88, minHeight: 92, alignSelf: "stretch", backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", gap: 5, opacity: deletingId === ride._id ? 0.6 : 1 }}
            >
              <Trash2 size={19} color="#ffffff" />
              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "900" }}>Delete</Text>
            </Pressable>
          )}
          renderRightActions={() => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit ride"
              onPress={() => router.push({ pathname: "/history/edit", params: { type: "ride", id: ride._id } })}
              style={{ width: 88, minHeight: 92, alignSelf: "stretch", backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", gap: 5 }}
            >
              <Pencil size={19} color="#ffffff" />
              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "900" }}>Edit</Text>
            </Pressable>
          )}
        >
          <Card>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 16 }}>{km(ride.distance)}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{dateLabel(ride.date)}</Text>
              </View>
              <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>{rideTimeLabel(ride.startAt, ride.endAt, ride.durationMinutes)}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{km(ride.startOdometer)} → {km(ride.endOdometer)} odometer</Text>
              {localTrack ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  Avg {averageSpeedKmh(localTrack).toFixed(1)} km/h · Max {localTrack.summary.maxSpeedKmh > 0 ? `${localTrack.summary.maxSpeedKmh.toFixed(1)} km/h` : "—"}
                </Text>
              ) : null}
              {ride.notes ? <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 19 }}>{ride.notes}</Text> : null}
              {localTrack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Share actual GPS activity"
                  onPress={() => openActivityShare(localTrack.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>Share actual GPS activity →</Text>
                </Pressable>
              ) : ride.route ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>This cloud ride has no local GPS points for activity sharing.</Text> : null}
              {localTrack ? (
                <AppButton
                  label="Export local GPS track (GPX)"
                  variant="outline"
                  compact
                  busy={exportingRideId === localTrack.id}
                  onPress={() => void exportGpx(localTrack)}
                />
              ) : null}
            </View>
          </Card>
        </ReanimatedSwipeable>
      ); })}

      {localOnly.length > 0 ? (
        <>
          <SectionTitle title="Local GPS tracks" />
          {localOnly.map((ride) => {
            return (
              <Card key={ride.id}>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 16 }}>{km(ride.summary.trackedDistance)}</Text>
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      {ride.demoMode ? <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 10 }}>SAMPLE · {ride.demoMode === "navigateAndRecord" ? "NAVIGATE + RECORD" : "RECORD ONLY"}</Text> : null}
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{dateLabel(ride.summary.date)}</Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>
                    {ride.demoMode ? "Sample ride · stays on this device" : ride.syncState === "synced" ? "Summary synced · GPS track stays on this device" : "Pending summary sync · GPS track stays on this device"}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{km(ride.summary.startOdometer)} → {km(ride.summary.endOdometer)} odometer</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    Avg {averageSpeedKmh(ride).toFixed(1)} km/h · Max {ride.summary.maxSpeedKmh > 0 ? `${ride.summary.maxSpeedKmh.toFixed(1)} km/h` : "—"}
                  </Text>
                  {ride.summary.notes ? <Text style={{ color: colors.foreground, fontSize: 13 }}>{ride.summary.notes}</Text> : null}
                  <AppButton label="Share Activity" variant="outline" onPress={() => openActivityShare(ride.id)} />
                  <AppButton label="Export GPX" variant="outline" busy={exportingRideId === ride.id} onPress={() => void exportGpx(ride)} />
                  {ride.demoMode ? <AppButton label="Remove sample" variant="ghost" icon={<Trash2 size={16} color={colors.danger} />} onPress={() => confirmDelete({ kind: "sample", id: ride.id, title: "Remove sample ride?", detail: "This removes the simulated ride from this phone. It does not affect real ride history." })} /> : null}
                </View>
              </Card>
            );
          })}
        </>
      ) : null}

      {rides !== undefined && cloudRides.length === 0 && personalLocalOnly.length === 0 ? <EmptyState title="No rides yet" body="Record a GPS ride or log one manually to start building your riding history." action={<AppButton label="Log your first ride" onPress={() => router.push({ pathname: "/log/[type]", params: { type: "ride" } })} />} /> : null}

      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!deletingId) setDeleteTarget(null); }}
      >
        <View style={{ flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(5, 8, 14, 0.62)" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel delete" onPress={() => { if (!deletingId) setDeleteTarget(null); }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View accessibilityViewIsModal style={{ gap: 16, padding: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.danger}16` }}>
                <Trash2 size={20} color={colors.danger} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "900" }}>{deleteTarget?.title ?? "Delete ride?"}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Please confirm this action.</Text>
              </View>
            </View>
            <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 21 }}>{deleteTarget?.detail}</Text>
            {deleteTarget?.kind === "cloud" ? <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>The local GPS track stays on this phone. Deleting the cloud summary cannot be undone.</Text> : null}
            {deleteError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13, lineHeight: 18 }}>{deleteError}</Text> : null}
            <View style={{ flexDirection: "row", gap: 9 }}>
              <View style={{ flex: 1 }}><AppButton label="Cancel" variant="outline" disabled={Boolean(deletingId)} onPress={() => setDeleteTarget(null)} /></View>
              <View style={{ flex: 1 }}><AppButton label={deletingId ? "Deleting…" : "Delete"} variant="danger" disabled={Boolean(deletingId)} onPress={() => void performConfirmedDelete()} icon={deletingId ? <ActivityIndicator color="#ffffff" /> : <Trash2 size={16} color="#ffffff" />} /></View>
            </View>
          </View>
        </View>
      </Modal>

    </Page>
  );
}
