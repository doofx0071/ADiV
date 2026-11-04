import { useEffect, useState } from "react";
import { AppText as Text } from "@/components/app-text";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ShareStudio } from "@/components/share-studio";
import { LoadingState, Page } from "@/components/ui";
import { getSavedLocalRide } from "@/lib/local-ride-store";
import type { LocalRideRecord } from "@/lib/ride-model";

type RideLoadState =
  | { rideId: string; status: "loading" }
  | { rideId: string; status: "ready"; ride: LocalRideRecord }
  | { rideId: string; status: "error"; message: string };

export default function ActivityShareScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const [loadState, setLoadState] = useState<RideLoadState>(() => ({ rideId, status: "loading" }));

  useEffect(() => {
    let active = true;
    void getSavedLocalRide(rideId)
      .then((ride) => {
        if (!active) return;
        setLoadState(ride
          ? { rideId, status: "ready", ride }
          : { rideId, status: "error", message: "This saved local ride is not available on this device." });
      })
      .catch((cause: unknown) => {
        if (active) {
          setLoadState({
            rideId,
            status: "error",
            message: cause instanceof Error ? cause.message : "Could not load the saved ride from this device.",
          });
        }
      });
    return () => { active = false; };
  }, [rideId]);

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      {loadState.rideId !== rideId || loadState.status === "loading" ? (
        <Page title="Activity Share" back><LoadingState label="Loading saved local ride…" /></Page>
      ) : loadState.status === "error" ? (
        <Page title="Activity Share" back>
          <Text style={{ color: "#b42318", fontSize: 14, lineHeight: 20 }}>{loadState.message}</Text>
        </Page>
      ) : (
        <Page scroll={false} immersive>
          <ShareStudio ride={loadState.ride} onClose={() => router.replace("/rides")} />
        </Page>
      )}
    </>
  );
}
