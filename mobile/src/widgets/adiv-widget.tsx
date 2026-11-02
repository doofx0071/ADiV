"use no memo";
/**
 * Home-screen widget (4x2): current odometer + the most urgent maintenance
 * item. Data comes from a snapshot the app writes to AsyncStorage whenever
 * its data syncs (components/widget-sync.tsx) — the widget never talks to
 * Convex itself.
 *
 * "use no memo" is required: react-native-android-widget renders in headless
 * mode and rejects React-Compiler-transformed components ("Invalid Hook
 * Call"). The compiler is enabled via the reactCompiler experiment.
 */
import { FlexWidget, TextWidget } from "react-native-android-widget";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface WidgetSnapshot {
  odometerKm: number;
  itemName: string | null;
  dueText: string | null;
  statusColor: `#${string}`;
  updatedAt: number;
}

export const WIDGET_SNAPSHOT_KEY = "adiv-widget-snapshot";

export async function saveWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

/** Renders with react-native-android-widget's FlexWidget/TextWidget API. */
export function AdivWidget({ snapshot }: { snapshot: WidgetSnapshot | null }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        backgroundColor: "#0f0f14",
        padding: 12,
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <TextWidget
          text="ADIV"
          style={{ color: "#e62025", fontSize: 11, fontWeight: "900", letterSpacing: 2 }}
        />
        <TextWidget
          text={snapshot ? `${Math.round(snapshot.odometerKm).toLocaleString("en-PH")} km` : "— km"}
          style={{ color: "#ffffff", fontSize: 17, fontWeight: "900" }}
        />
      </FlexWidget>
      <FlexWidget
        style={{ height: 1, backgroundColor: "#26262e", marginVertical: 8, width: "match_parent" }}
      />
      <TextWidget
        text="NEXT SERVICE"
        style={{ color: "#8b8b98", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}
      />
      <TextWidget
        text={snapshot?.itemName ?? "Complete setup in the app"}
        style={{ color: snapshot?.itemName ? "#ffffff" : "#8b8b98", fontSize: 14, fontWeight: "800" }}
        maxLines={1}
      />
      <TextWidget
        text={snapshot?.dueText ?? "Open ADiV to sync"}
        style={{ color: snapshot?.statusColor ?? "#8b8b98", fontSize: 12, fontWeight: "700" }}
        maxLines={1}
      />
    </FlexWidget>
  );
}
