import { useEffect } from "react";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { LoadingState, Page } from "@/components/ui";

export default function EntryScreen() {
  const bike = useQuery(api.bike.getBike);
  useEffect(() => {
    if (bike === undefined) return;
    router.replace(bike ? "/(tabs)" : "/setup");
  }, [bike]);
  return <Page><LoadingState label="Connecting to your garage…" /></Page>;
}
