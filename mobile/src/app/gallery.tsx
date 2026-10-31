import { useMemo, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { EmptyState, LoadingState, Page } from "@/components/ui";
import { dateLabel } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";

export default function GalleryScreen() {
  const logs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 1000 });
  const storageIds = useMemo(() => [...new Set((logs ?? []).flatMap((log) => log.photos ?? []))], [logs]);
  const urls = useQuery(api.files.getFileUrls, storageIds.length ? { storageIds } : "skip");
  const [selected, setSelected] = useState<string | null>(null);
  const { colors } = useAppTheme();

  if (logs === undefined || urls === undefined && storageIds.length > 0) return <Page back><LoadingState label="Loading service photos…" /></Page>;
  const urlMap = new Map((urls ?? []).flatMap((entry) => entry.url ? [[entry.storageId, entry.url] as const] : []));
  const cards = (logs ?? []).flatMap((log) => (log.photos ?? []).flatMap((storageId) => {
    const uri = urlMap.get(storageId);
    return uri ? [{ key: storageId, uri, item: log.itemName ?? "Service", date: log.date }] : [];
  }));

  return (
    <Page back eyebrow="Garage photos" title="Service gallery" subtitle="Photos attached to your maintenance history.">
      {cards.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{cards.map((photo) => (
        <Pressable key={photo.key} onPress={() => setSelected(photo.uri)} style={{ width: "48%", gap: 5 }}>
          <Image source={{ uri: photo.uri }} alt={`${photo.item} service photo`} contentFit="cover" style={{ width: "100%", aspectRatio: 1, borderRadius: 0, backgroundColor: colors.secondary }} />
          <Text style={{ color: colors.foreground, fontWeight: "800", fontSize: 13 }} numberOfLines={1}>{photo.item}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{dateLabel(photo.date)}</Text>
        </Pressable>
      ))}</View> : <EmptyState title="No service photos yet" body="Attach photos when logging a completed maintenance task. Each log supports up to five photos." />}
      <Modal visible={selected !== null} animationType="fade" transparent onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.94)", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close photo" onPress={() => setSelected(null)} style={{ position: "absolute", top: 48, right: 22, zIndex: 2, width: 44, height: 44, borderRadius: 0, backgroundColor: "#24242d", alignItems: "center", justifyContent: "center" }}><X color="#fff" size={20} /></Pressable>
          {selected ? <Image source={{ uri: selected }} alt="Selected service photo" contentFit="contain" style={{ width: "100%", height: "78%" }} /> : null}
        </View>
      </Modal>
    </Page>
  );
}
