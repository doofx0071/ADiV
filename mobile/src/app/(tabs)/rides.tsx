import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Disc, Pencil, Trash2 } from "lucide-react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { api, type Id } from "@/lib/api";
import { AppButton, Card, EmptyState, LoadingState, Page, SectionTitle } from "@/components/ui";
import { ShareStudio } from "@/components/share-studio";
import { dateLabel, km, rideTimeLabel } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";

interface RouteView {
  route: string;
  title: string;
  date: number;
  distanceKm: number;
  durationMinutes: number;
}

export default function RidesScreen() {
  const rides = useQuery(api.rides.getRides, { limit: 1000 });
  const deleteRide = useMutation(api.rides.deleteRide);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [routeView, setRouteView] = useState<RouteView | null>(null);
  const { colors } = useAppTheme();

  function confirmDelete(rideId: string) {
    Alert.alert("Delete this ride?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        setDeletingId(rideId);
        void deleteRide({ rideId: rideId as Id<"rides"> })
          .catch((error) => Alert.alert("Could not delete", error instanceof Error ? error.message : "Please try again."))
          .finally(() => setDeletingId(null));
      } },
    ]);
  }

  if (rides === undefined) return <Page><LoadingState label="Loading rides…" /></Page>;

  return (
    <Page eyebrow="Your rides" title="Rides" subtitle={`${rides.length} ${rides.length === 1 ? "ride" : "rides"} logged`}>
      {/* Ride hub: live GPS recording front and center */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 42, height: 42, borderRadius: 0, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}14` }}>
              <Disc size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 16 }}>Record a GPS ride</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Background tracking · voice turns · route on a map</Text>
            </View>
          </View>
          <AppButton label="Start recording" onPress={() => router.push("/record")} icon={<Disc size={17} color="#ffffff" />} />
          <AppButton
            label="Log manually instead"
            variant="outline"
            onPress={() => router.push({ pathname: "/log/[type]", params: { type: "ride" } })}
            icon={<Pencil size={16} color={colors.primary} />}
          />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            Forgot to record, or low battery? Log the ride manually and the odometer still syncs.
          </Text>
        </View>
      </Card>

      <SectionTitle title="All rides" />
      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Swipe left to edit · swipe right to delete</Text>
      {rides.map((ride) => (
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
              onPress={() => confirmDelete(ride._id)}
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
              {ride.notes ? <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 19 }}>{ride.notes}</Text> : null}
              {ride.route ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View GPS route"
                  onPress={() => setRouteView({ route: ride.route!, title: ride.notes || "Ride", date: ride.date, distanceKm: ride.trackedDistance ?? ride.distance, durationMinutes: ride.durationMinutes })}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>GPS tracked · view route →</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        </ReanimatedSwipeable>
      ))}
      {rides.length === 0 ? <EmptyState title="No rides yet" body="Record a GPS ride or log one manually to start building your riding history." action={<AppButton label="Log your first ride" onPress={() => router.push({ pathname: "/log/[type]", params: { type: "ride" } })} />} /> : null}

      {routeView ? (
        <ShareStudio
          route={routeView.route}
          title={routeView.title}
          date={routeView.date}
          distanceKm={routeView.distanceKm}
          durationMinutes={routeView.durationMinutes}
          onClose={() => setRouteView(null)}
        />
      ) : null}
    </Page>
  );
}
