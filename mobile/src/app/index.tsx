import { useEffect } from "react";
import { Platform } from "react-native";
import * as Network from "expo-network";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { LoadingState, Page } from "@/components/ui";
import { useShareSafeQuery } from "@/lib/share-safe-query";

const ANDROID_BACKEND_STARTUP_TIMEOUT_MS = 5_000;

export default function EntryScreen() {
  const bike = useShareSafeQuery(api.bike.getBike);
  useEffect(() => {
    let active = true;
    let routed = false;

    const openLocalRides = () => {
      if (!active || routed) return;
      routed = true;
      if (startupTimeout) clearTimeout(startupTimeout);
      router.replace("/(tabs)/rides");
    };

    const openGarage = () => {
      if (!active || routed || bike === undefined) return;
      routed = true;
      if (startupTimeout) clearTimeout(startupTimeout);
      router.replace(bike ? "/(tabs)" : "/setup");
    };

    const startupTimeout: ReturnType<typeof setTimeout> | undefined = Platform.OS === "android"
      ? setTimeout(openLocalRides, ANDROID_BACKEND_STARTUP_TIMEOUT_MS)
      : undefined;

    if (Platform.OS !== "android") {
      openGarage();
      return () => { active = false; };
    }

    // Do not let an unavailable Convex connection block access to local rides
    // and the installed offline map on an Android cold start.
    void Network.getNetworkStateAsync().then((network) => {
      if (!active || routed) return;
      if (network.isConnected === false || network.isInternetReachable === false) {
        openLocalRides();
        return;
      }
      openGarage();
    }).catch(() => {
      if (bike === undefined) openLocalRides();
      else openGarage();
    });

    return () => {
      active = false;
      if (startupTimeout) clearTimeout(startupTimeout);
    };
  }, [bike]);
  return <Page><LoadingState label="Connecting to your garage…" /></Page>;
}
