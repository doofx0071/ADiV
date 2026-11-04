import { useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Alert, Image, PixelRatio, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { AppButton } from "@/components/ui";
import { useAppTheme } from "@/lib/theme";
import { Asset } from "expo-media-library";
import * as MediaLibrary from "expo-media-library";
import { captureRef, releaseCapture } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { Download, Share2, X } from "lucide-react-native";
import Svg, { Circle, G, Polyline, Text as SvgText, SvgXml } from "react-native-svg";
import {
  ACTIVITY_SHARE_SIZE,
  buildActivityShareData,
  projectTrackSegments,
  type ActivityShareAspect,
  type ActivityShareTemplate,
  type RoutePosition,
} from "@/lib/activity-share";
import type { LocalRideRecord } from "@/lib/ride-model";
import ADiVHeadLogo from "../../assets/images/ADiV-shesh.png";

export interface ShareStudioProps {
  ride: LocalRideRecord;
  onClose: () => void;
}

const TEMPLATES: { key: ActivityShareTemplate; label: string }[] = [
  { key: "routeOnly", label: "Route Only" },
  { key: "statisticsOnly", label: "Statistics Only" },
  { key: "routeAndStatistics", label: "Route + Statistics" },
];
const MASK_OPTIONS = [0, 100, 250, 500] as const;
const ROUTE_COLORS = ["#E62025", "#147D64", "#2563EB", "#111318"] as const;
const ROUTE_WIDTHS = [6, 10, 14] as const;
const ARTWORK_SIZES = ["small", "medium", "large"] as const;
const ARTWORK_SCALE = { small: 0.82, medium: 1, large: 1.22 } as const;
const ROUTE_PADDING: Record<"compact" | "default" | "large", number> = {
  compact: 0.22,
  default: 0.12,
  large: 0.05,
};
// Mirrors public/adv-logo-dark.svg so Metro can render the source vector inside
// the captured canvas. The white letters follow the selected export contrast.
const ADIV_WORDMARK_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="25 235 550 120" preserveAspectRatio="xMidYMid meet"><g transform="translate(0.000000,600.000000) scale(0.050000,-0.050000)" fill="#ffffff" stroke="none"><path fill="#ffffff" d="M2020 6496 c-192 -178 -570 -525 -840 -773 -269 -247 -512 -470 -540 -496 l-49 -47 331 0 331 0 676 625 c372 344 684 628 694 632 9 3 17 -93 17 -215 l0 -222 -155 0 -156 0 -199 -181 c-110 -100 -203 -190 -207 -200 -4 -12 137 -19 355 -19 l362 0 0 -210 0 -210 260 0 260 0 0 820 0 820 -395 -1 -395 0 -350 -323z"/><path fill="#ffffff" d="M3260 6058 c0 -724 2 -761 35 -736 19 15 136 121 260 235 l225 208 0 328 0 328 505 -6 505 -5 6 -83 6 -83 -325 -302 -324 -302 -152 0 -152 0 -242 -225 -242 -225 539 -5 c296 -3 550 1 565 10 14 8 211 186 438 395 l412 380 0 425 1 425 -1030 0 -1030 0 0 -762z"/><path fill="#ffffff" d="M5420 6660 l0 -160 260 0 260 0 0 160 0 160 -260 0 -260 0 0 -160z"/><path fill="#e62025" d="M6640 6197 c-368 -342 -764 -710 -880 -818 l-210 -197 327 -1 327 -1 234 215 c345 317 1295 1199 1422 1320 l110 104 -330 0 -330 -1 -670 -621z"/><path fill="#ffffff" d="M5430 6376 c-6 -15 -8 -275 -5 -579 l5 -553 255 233 256 233 -6 340 -5 340 -245 6 c-190 5 -248 1 -255 -20z"/><path fill="#e62025" d="M7140 5870 l-129 -130 155 0 154 0 0 -280 0 -280 250 0 250 0 0 410 0 410 -276 0 -275 0 -129 -130z"/><path fill="#e62025" d="M8125 5879 l-145 -120 0 -289 0 -290 662 -1 662 -1 128 102 128 101 0 139 0 138 -550 0 -550 0 0 80 0 80 565 1 565 1 99 89 100 89 -760 0 -759 -1 -145 -120z m885 -459 l0 -90 -275 -6 -275 -5 0 101 0 101 275 -5 275 -6 0 -90z"/><path fill="#e62025" d="M9895 5844 l-175 -154 0 -255 0 -255 667 0 667 0 70 55 c38 30 116 87 173 125 l103 70 0 285 0 285 -665 -1 -665 -1 -175 -154z m955 -254 l0 -220 -305 -6 -305 -5 0 231 0 231 305 -5 305 -6 0 -220z"/></g></svg>`;

function formatDuration(value: number | null): string {
  if (value === null) return "Unavailable";
  const minutes = Math.max(0, Math.round(value / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function formatMetric(value: number | null, suffix: string): string {
  return value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)} ${suffix}`;
}

function CheckeredPreview({ light, dark }: { light: string; dark: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: "100%", height: "100%", overflow: "hidden" }}>
      {Array.from({ length: 10 }, (_, row) => (
        <View key={row} style={{ flex: 1, flexDirection: "row" }}>
          {Array.from({ length: 10 }, (_, column) => (
            <View key={column} style={{ flex: 1, backgroundColor: (row + column) % 2 === 0 ? light : dark }} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Choice({
  label,
  selected,
  disabled,
  onPress,
  foreground,
  muted,
  border,
  accent,
  compact = false,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: compact ? 38 : 42,
        flexGrow: 1,
        paddingHorizontal: compact ? 11 : 13,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: selected ? accent : border,
        backgroundColor: selected ? accent : "transparent",
        opacity: disabled ? 0.42 : pressed ? 0.76 : 1,
      })}
    >
      <Text style={{ color: selected ? "#ffffff" : disabled ? muted : foreground, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

export function ShareStudio({ ride, onClose }: ShareStudioProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colors, resolved } = useAppTheme();
  const [template, setTemplate] = useState<ActivityShareTemplate>("routeAndStatistics");
  const [aspect, setAspect] = useState<ActivityShareAspect>("story");
  const [maskMeters, setMaskMeters] = useState<number>(0);
  const [showEndpoints, setShowEndpoints] = useState(true);
  const [routeColor, setRouteColor] = useState<string>(ROUTE_COLORS[0]);
  const [routeWidth, setRouteWidth] = useState<number>(ROUTE_WIDTHS[1]);
  const [routeScale, setRouteScale] = useState<keyof typeof ROUTE_PADDING>("default");
  const [routePosition, setRoutePosition] = useState<RoutePosition>("center");
  const [textContrast, setTextContrast] = useState<"light" | "dark">(resolved === "dark" ? "light" : "dark");
  const [statisticsSize, setStatisticsSize] = useState<(typeof ARTWORK_SIZES)[number]>("large");
  const [logoSize, setLogoSize] = useState<(typeof ARTWORK_SIZES)[number]>("large");
  const [includeMaxSpeed, setIncludeMaxSpeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [headLogoReady, setHeadLogoReady] = useState(false);
  const canvasRef = useRef<ComponentRef<typeof View>>(null);
  const [permissionResponse, requestMediaPermission] = MediaLibrary.usePermissions({
    writeOnly: true,
    granularPermissions: ["photo"],
  });

  const output = ACTIVITY_SHARE_SIZE[aspect];
  const canvasWidth = Math.min(Math.max(240, screenWidth - 36), aspect === "story" ? 270 : 310);
  const canvasHeight = canvasWidth * output.height / output.width;
  const canvasScale = canvasWidth / output.width;
  const activity = useMemo(() => buildActivityShareData(ride, maskMeters, maskMeters), [ride, maskMeters]);
  const routeTemplate = template !== "statisticsOnly";
  const routeDisabled = routeTemplate && !activity.routeAvailable;
  const showRouteEndpoints = showEndpoints && maskMeters === 0;
  const primaryText = textContrast === "light" ? "#FFFFFF" : "#111318";
  const wordmarkXml = useMemo(() => ADIV_WORDMARK_XML.replaceAll("#ffffff", primaryText), [primaryText]);

  const routeBox = useMemo(() => {
    if (aspect === "story") {
      return template === "routeAndStatistics"
        ? { x: 90, y: 75, width: 900, height: 900 }
        : { x: 90, y: 75, width: 900, height: 1430 };
    }
    return template === "routeAndStatistics"
      ? { x: 90, y: 45, width: 900, height: 430 }
      : { x: 90, y: 45, width: 900, height: 820 };
  }, [aspect, template]);

  const projectedRuns = useMemo(
    () => projectTrackSegments(
      activity.routeSegments,
      routeBox.width,
      routeBox.height,
      Math.min(routeBox.width, routeBox.height) * ROUTE_PADDING[routeScale],
      routePosition,
    ).map((run) => run.map(([x, y]) => [x + routeBox.x, y + routeBox.y] as [number, number])),
    [activity.routeSegments, routeBox, routePosition, routeScale],
  );
  const startPoint = projectedRuns[0]?.[0];
  const endPoint = projectedRuns.at(-1)?.at(-1);
  const distance = `${activity.stats.distanceKm.toFixed(1)} km`;
  const moving = formatDuration(activity.stats.movingMs);
  const stopped = formatDuration(activity.stats.stoppedMs);
  const elapsed = formatDuration(activity.stats.elapsedMs);
  const average = formatMetric(activity.stats.averageSpeedKmh, "km/h");
  const maximum = activity.stats.maxSpeedKmh > 0 ? formatMetric(activity.stats.maxSpeedKmh, "km/h") : "—";

  const statLayout = useMemo(() => {
    const scale = ARTWORK_SCALE[statisticsSize];
    if (aspect === "story") {
      const top = template === "statisticsOnly" ? 610 : 1010;
      return { title: top, distance: top + 95, firstLabel: top + 230, firstValue: top + 278, secondLabel: top + 376, secondValue: top + 424, labelSize: 25 * scale, valueSize: 34 * scale, distanceSize: 100 * scale };
    }
    const top = template === "statisticsOnly" ? 245 : 505;
    return { title: top, distance: top + 75, firstLabel: top + 178, firstValue: top + 214, secondLabel: top + 290, secondValue: top + 326, labelSize: 19 * scale, valueSize: 25 * scale, distanceSize: 74 * scale };
  }, [aspect, statisticsSize, template]);

  const logoScale = ARTWORK_SCALE[logoSize];
  const logoWordmarkWidth = (aspect === "story" ? 300 : 255) * logoScale;
  const logoWordmarkHeight = (aspect === "story" ? 72 : 62) * logoScale;
  const logoHeadSize = (aspect === "story" ? 92 : 76) * logoScale;
  const logoRowHeight = Math.max(logoWordmarkHeight, logoHeadSize);
  const logoTop = template === "routeOnly"
    ? output.height - logoRowHeight - (aspect === "story" ? 150 : 90)
    : statLayout.secondValue + Math.max(56, statLayout.valueSize * 1.5);

  async function capturePng(): Promise<string | null> {
    if (!canvasRef.current || !canvasReady) {
      Alert.alert("Preview is still loading", "Wait for the route preview to appear, then try again.");
      return null;
    }
    if (routeDisabled) {
      Alert.alert("No route to export", "This ride does not have two valid GPS points. Statistics Only is available.");
      return null;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return captureRef(canvasRef, {
      format: "png",
      result: "tmpfile",
      width: Platform.OS === "ios" ? output.width / PixelRatio.get() : output.width,
      height: Platform.OS === "ios" ? output.height / PixelRatio.get() : output.height,
    });
  }

  async function handleShare() {
    setBusy(true);
    let uri: string | null = null;
    try {
      uri = await capturePng();
      if (!uri) return;
      if (!await Sharing.isAvailableAsync()) {
        Alert.alert("Sharing unavailable", "Try again on Android or iOS, or save the PNG to your Gallery.");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share ADiV activity image", UTI: "public.png" });
    } catch (error) {
      Alert.alert("Could not share image", error instanceof Error ? error.message : "Check free device storage and try again.");
    } finally {
      if (uri) releaseCapture(uri);
      setBusy(false);
    }
  }

  async function handleSaveToGallery() {
    setBusy(true);
    let uri: string | null = null;
    try {
      const permission = permissionResponse?.granted ? permissionResponse : await requestMediaPermission();
      if (!permission.granted) {
        Alert.alert("Photo permission not granted", "Allow ADiV to save images, or use Share PNG to choose another app.");
        return;
      }
      uri = await capturePng();
      if (!uri) return;
      await Asset.create(uri);
      Alert.alert("Saved to Gallery", "The activity PNG has a transparent background.");
    } catch (error) {
      Alert.alert("Could not save image", error instanceof Error ? error.message : "Check photo permission and free device storage.");
    } finally {
      if (uri) releaseCapture(uri);
      setBusy(false);
    }
  }

  function renderStats() {
    const centers = [190, 540, 890];
    const secondRowCenters = [320, 760];
    const metric = (x: number, label: string, value: string, key: string, labelY = statLayout.firstLabel, valueY = statLayout.firstValue) => (
      <G key={key}>
        <SvgText x={x} y={labelY} textAnchor="middle" fill={primaryText} opacity={0.68} fontFamily="Geist_700Bold" fontSize={statLayout.labelSize} letterSpacing={2}>{label}</SvgText>
        <SvgText x={x} y={valueY} textAnchor="middle" fill={primaryText} fontFamily="Geist_700Bold" fontSize={statLayout.valueSize}>{value}</SvgText>
      </G>
    );

    return (
      <G>
        <SvgText x={output.width / 2} y={statLayout.title} textAnchor="middle" fill={primaryText} opacity={0.68} fontFamily="Geist_700Bold" fontSize={statLayout.labelSize} letterSpacing={3}>DISTANCE</SvgText>
        <SvgText x={output.width / 2} y={statLayout.distance} textAnchor="middle" fill={primaryText} fontFamily="Geist_900Black" fontSize={statLayout.distanceSize}>{distance}</SvgText>
        {metric(centers[0], "MOVING", moving, "moving")}
        {metric(centers[1], "STOPPED", stopped, "stopped")}
        {metric(centers[2], "ELAPSED", elapsed, "elapsed")}
        {metric(secondRowCenters[0], "AVG SPEED", average, "average", statLayout.secondLabel, statLayout.secondValue)}
        {includeMaxSpeed ? metric(secondRowCenters[1], "MAX SPEED", maximum, "maximum", statLayout.secondLabel, statLayout.secondValue) : null}
      </G>
    );
  }

  const content = (
    <Svg width={canvasWidth} height={canvasHeight} viewBox={`0 0 ${output.width} ${output.height}`} preserveAspectRatio="xMidYMid meet">
      {routeTemplate && activity.routeAvailable ? (
        <G>
          {projectedRuns.map((run, index) => (
            <Polyline key={`route-${index}`} points={run.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke={routeColor} strokeWidth={routeWidth} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {showRouteEndpoints && startPoint ? <Circle cx={startPoint[0]} cy={startPoint[1]} r={routeWidth + 5} fill="#FFFFFF" stroke={routeColor} strokeWidth={routeWidth} /> : null}
          {showRouteEndpoints && endPoint ? <Circle cx={endPoint[0]} cy={endPoint[1]} r={routeWidth + 5} fill={routeColor} stroke="#FFFFFF" strokeWidth={4} /> : null}
        </G>
      ) : null}
      {template !== "routeOnly" ? renderStats() : null}
    </Svg>
  );

  const section = (title: string, children: ReactNode) => (
    <View style={{ width: "100%", gap: 8 }}>
      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 }}>{title}</Text>
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ minHeight: 58, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "900", letterSpacing: -0.4 }}>Activity Share</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Saved ride · private, transparent export</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close activity share" onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <X size={21} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: "center", gap: 18, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 22 }} keyboardShouldPersistTaps="handled" overScrollMode="never">
        <View style={{ alignSelf: "stretch", gap: 9, alignItems: "center" }}>
          <View style={{ width: canvasWidth, height: canvasHeight, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
            <CheckeredPreview light={resolved === "dark" ? "#30303b" : "#f1f2f4"} dark={resolved === "dark" ? "#252530" : "#d9dce1"} />
            <View ref={canvasRef} collapsable={false} onLayout={() => setCanvasReady(true)} style={{ width: canvasWidth, height: canvasHeight, backgroundColor: "transparent", overflow: "hidden" }}>
              {content}
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: logoTop * canvasScale, height: logoRowHeight * canvasScale, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22 * logoScale * canvasScale }}>
                <SvgXml xml={wordmarkXml} width={logoWordmarkWidth * canvasScale} height={logoWordmarkHeight * canvasScale} />
                <Text style={{ color: primaryText, fontFamily: "Geist_700Bold", fontSize: logoHeadSize * 0.78 * canvasScale, lineHeight: logoRowHeight * canvasScale }}>|</Text>
                <Image
                  source={ADiVHeadLogo}
                  alt=""
                  resizeMode="contain"
                  onLoadEnd={() => setHeadLogoReady(true)}
                  style={{ width: logoHeadSize * canvasScale, height: logoHeadSize * canvasScale }}
                />
              </View>
            </View>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "center", lineHeight: 16 }}>Transparent Full HD PNG · route, statistics, and both ADiV logos. The checkerboard is preview-only.</Text>
        </View>

        {section("TEMPLATE", (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {TEMPLATES.map((option) => {
              const disabled = option.key !== "statisticsOnly" && !activity.routeAvailable;
              return <Choice key={option.key} label={option.label} selected={template === option.key} disabled={disabled} onPress={() => setTemplate(option.key)} foreground={colors.foreground} muted={colors.mutedForeground} border={colors.border} accent={colors.primary} compact />;
            })}
          </View>
        ))}
        {routeDisabled ? <Text style={{ width: "100%", color: colors.warning, fontSize: 12 }}>Route templates need two valid GPS points. Statistics Only remains available for this ride.</Text> : null}

        {section("SIZE", (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["story", "square"] as const).map((value) => <Choice key={value} label={value === "story" ? "Story · Full HD · 1080×1920" : "Square · 1080×1080"} selected={aspect === value} onPress={() => { setAspect(value); setCanvasReady(false); }} foreground={colors.foreground} muted={colors.mutedForeground} border={colors.border} accent={colors.primary} />)}
          </View>
        ))}

        {section("LOGO SIZE", (
          <View style={{ flexDirection: "row", gap: 7 }}>
            {ARTWORK_SIZES.map((value) => <Choice key={value} label={value[0].toUpperCase() + value.slice(1)} selected={logoSize === value} onPress={() => setLogoSize(value)} foreground={colors.foreground} muted={colors.mutedForeground} border={colors.border} accent={colors.primary} compact />)}
          </View>
        ))}

        {routeTemplate ? (
          <>
            {section("PRIVACY · CLIP TRACK ENDS", (
              <View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>
                {MASK_OPTIONS.map((value) => <Choice key={value} label={value === 0 ? "Off" : `${value} m`} selected={maskMeters === value} onPress={() => setMaskMeters(value)} foreground={colors.foreground} muted={colors.mutedForeground} border={colors.border} accent={colors.primary} compact />)}
              </View>
            ))}
            {maskMeters > 0 ? <Text style={{ width: "100%", color: colors.mutedForeground, fontSize: 11, lineHeight: 16 }}>Privacy clipping affects this exported image only. Saved GPS history and ordinary GPX exports stay unchanged; endpoint markers are hidden while clipping is active.</Text> : null}

            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: showEndpoints, disabled: maskMeters > 0 }} disabled={maskMeters > 0} onPress={() => setShowEndpoints((value) => !value)} style={{ minHeight: 42, alignSelf: "stretch", flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, opacity: maskMeters > 0 ? 0.5 : 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>{showRouteEndpoints ? "Start and finish markers on" : "Start and finish markers off"}</Text>
            </Pressable>

            {section("ROUTE APPEARANCE", (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  {ROUTE_COLORS.map((color) => <Pressable key={color} accessibilityRole="button" accessibilityLabel={`Route color ${color}`} accessibilityState={{ selected: routeColor === color }} onPress={() => setRouteColor(color)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: color, borderWidth: routeColor === color ? 3 : 1, borderColor: routeColor === color ? colors.primary : colors.border }} />)}
                </View>
                <View style={{ flexDirection: "row", gap: 7 }}>
                  {ROUTE_WIDTHS.map((value) => <Choice key={value} label={value === 6 ? "Fine" : value === 10 ? "Regular" : "Bold"} selected={routeWidth === value} onPress={() => setRouteWidth(value)} foreground={colors.foreground} muted={colors.mutedForeground} border={colors.border} accent={colors.primary} compact />)}
                </View>
                <View style={{ flexDirection: "row", gap: 7 }}>
                  {(["compact", "default", "large"] as const).map((value) => <Choice key={value} label={value === "compact" ? "Small" : value === "default" ? "Fit" : "Large"} selected={routeScale === value} onPress={() => setRouteScale(value)} foreground={colors.foreground} muted={colors.mutedForeground} border={colors.border} accent={colors.primary} compact />)}
                </View>
                <View style={{ flexDirection: "row", gap: 7 }}>
                  {(["top", "center", "bottom"] as const).map((value) => <Choice key={value} label={value} selected={routePosition === value} onPress={() => setRoutePosition(value)} foreground={colors.foreground} muted={colors.mutedForeground} border={colors.border} accent={colors.primary} compact />)}
                </View>
              </View>
            ))}
          </>
        ) : null}

        {template !== "routeOnly" ? (
          <>
            {section("STATISTICS", (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {(["light", "dark"] as const).map((value) => <Choice key={value} label={value === "light" ? "Light text" : "Dark text"} selected={textContrast === value} onPress={() => setTextContrast(value)} foreground={colors.foreground} muted={colors.mutedForeground} border={colors.border} accent={colors.primary} compact />)}
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: includeMaxSpeed }} onPress={() => setIncludeMaxSpeed((value) => !value)} style={{ minHeight: 38, flexGrow: 1, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: includeMaxSpeed ? colors.primary : colors.border, backgroundColor: includeMaxSpeed ? colors.primary : "transparent" }}>
                  <Text style={{ color: includeMaxSpeed ? "#ffffff" : colors.foreground, fontSize: 12, fontWeight: "700" }}>Max speed</Text>
                </Pressable>
              </View>
            ))}
            {section("STATISTICS SIZE", (
              <View style={{ flexDirection: "row", gap: 7 }}>
                {ARTWORK_SIZES.map((value) => <Choice key={value} label={value[0].toUpperCase() + value.slice(1)} selected={statisticsSize === value} onPress={() => setStatisticsSize(value)} foreground={colors.foreground} muted={colors.mutedForeground} border={colors.border} accent={colors.primary} compact />)}
              </View>
            ))}
            <Text style={{ width: "100%", color: colors.mutedForeground, fontSize: 11, lineHeight: 16 }}>Moving and stopped time use valid GPS intervals, with a 3 km/h moving threshold. Gaps over 15 seconds are not estimated. The planned navigation route is never used in the export.</Text>
          </>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 9, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <View style={{ flex: 1 }}><AppButton label={busy ? "Preparing…" : "Share PNG"} onPress={() => void handleShare()} busy={busy} disabled={routeDisabled || !canvasReady || !headLogoReady} icon={<Share2 size={17} color="#ffffff" />} /></View>
        <View style={{ flex: 1 }}><AppButton label="Save PNG" variant="outline" onPress={() => void handleSaveToGallery()} busy={busy} disabled={routeDisabled || !canvasReady || !headLogoReady} icon={<Download size={17} color={colors.foreground} />} /></View>
      </View>
    </View>
  );
}
