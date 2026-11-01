/**
 * Strava-style Share Studio: swipeable carousel of share-card styles for a
 * GPS ride — map + line, line only (dark), and line overlaid on a chosen
 * photo. The active card is captured to an image and shared.
 */
import { useMemo, useRef, useState, type ComponentRef } from "react";
import { Alert, FlatList, Modal, Pressable, View, useWindowDimensions } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { Map as MapView, Camera, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { ImagePlus, Share2, X } from "lucide-react-native";
import Svg, { Polyline } from "react-native-svg";
import { AppButton } from "@/components/ui";
import { dateLabel, km } from "@/lib/format";
import { decodePolyline } from "@/lib/shared";
import { OSM_STYLE, ROUTE_LINE_PAINT, boundsFor, projectToPath, routeFeatureCollection } from "@/lib/map-style";

export interface ShareStudioProps {
  route: string;
  title: string;
  date: number;
  distanceKm: number;
  durationMinutes: number;
  onClose: () => void;
}

const CARD_STYLES = [
  { key: "map", label: "Map" },
  { key: "line", label: "Line only" },
  { key: "photo", label: "Photo overlay" },
] as const;

const DARK = "#0a0a0f";
const CARD_HEIGHT = 380;

export function ShareStudio({ route, title, date, distanceKm, durationMinutes, onClose }: ShareStudioProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - 48, 420);
  const coordinates = useMemo(() => decodePolyline(route), [route]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const activeCardRef = useRef<ComponentRef<typeof View>>(null);

  const avgSpeed = durationMinutes > 0 ? (distanceKm / durationMinutes) * 60 : 0;
  const svgPoints = useMemo(() => projectToPath(coordinates, 360, 240), [coordinates]);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setActiveIndex(CARD_STYLES.findIndex((style) => style.key === "photo"));
    }
  }

  async function handleShare() {
    if (!activeCardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(activeCardRef, { format: "png", quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your ride" });
    } catch {
      Alert.alert("Could not share", "Try again in a moment.");
    } finally {
      setSharing(false);
    }
  }

  const stats = (
    <View style={{ padding: 14, gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: "#e62025", fontWeight: "900", fontSize: 14, letterSpacing: 2 }}>ADIV</Text>
        <Text style={{ color: "#8b8b98", fontSize: 12 }}>{dateLabel(date)}</Text>
      </View>
      <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 15 }} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 20 }}>{km(distanceKm)}</Text>
        <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 20 }}>{durationMinutes} min</Text>
        <Text style={{ color: "#e62025", fontWeight: "900", fontSize: 20 }}>
          {avgSpeed > 0 ? `${avgSpeed.toFixed(1)} km/h` : "—"}
        </Text>
      </View>
    </View>
  );

  const renderCard = ({ key }: { key: string }) => {
    if (key === "map") {
      return (
        <View style={{ height: CARD_HEIGHT, backgroundColor: DARK }}>
          <MapView mapStyle={OSM_STYLE} style={{ flex: 1 }}>
            <Camera bounds={boundsFor(coordinates)} padding={{ top: 40, right: 40, bottom: 40, left: 40 }} />
            <GeoJSONSource id="studioRoute" data={routeFeatureCollection([coordinates])}>
              <Layer id="studioRouteLine" type="line" paint={ROUTE_LINE_PAINT} />
            </GeoJSONSource>
          </MapView>
        </View>
      );
    }
    if (key === "line") {
      return (
        <View style={{ height: CARD_HEIGHT, backgroundColor: DARK, justifyContent: "flex-end" }}>
          <Svg width="100%" height={CARD_HEIGHT - 140} viewBox="0 0 360 240">
            <Polyline
              points={svgPoints}
              fill="none"
              stroke="#e62025"
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>{stats}</View>
        </View>
      );
    }
    return (
      <View style={{ height: CARD_HEIGHT, backgroundColor: DARK }}>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            alt="Ride backdrop"
            contentFit="cover"
            style={{ width: "100%", height: "100%", position: "absolute" }}
          />
        ) : null}
        <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Svg width="100%" height={CARD_HEIGHT - 150} viewBox="0 0 360 240">
            <Polyline
              points={svgPoints}
              fill="none"
              stroke="#ffffff"
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>{stats}</View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.94)", justifyContent: "center", padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 17 }}>Share Activity</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close share studio" onPress={onClose} style={{ padding: 8 }}>
            <X size={20} color="#ffffff" />
          </Pressable>
        </View>

        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={CARD_STYLES}
          keyExtractor={(item) => item.key}
          onMomentumScrollEnd={(event) =>
            setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / screenWidth))
          }
          renderItem={({ item }) => (
            <View style={{ width: screenWidth, alignItems: "center" }}>
              <View
                ref={item.key === CARD_STYLES[activeIndex].key ? activeCardRef : undefined}
                collapsable={false}
                style={{ width: cardWidth, backgroundColor: DARK, overflow: "hidden" }}
              >
                {renderCard(item)}
              </View>
            </View>
          )}
        />

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 7, marginVertical: 12 }}>
          {CARD_STYLES.map((style, index) => (
            <Pressable
              key={style.key}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${style.label}`}
              onPress={() => setActiveIndex(index)}
              style={{
                width: index === activeIndex ? 18 : 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: index === activeIndex ? "#e62025" : "#3a3a44",
              }}
            />
          ))}
        </View>

        {CARD_STYLES[activeIndex].key === "photo" ? (
          <AppButton
            label={photoUri ? "Choose a different photo" : "Choose a photo"}
            variant="outline"
            onPress={() => void pickPhoto()}
            icon={<ImagePlus size={16} color="#e62025" />}
          />
        ) : null}
        <AppButton
          label={sharing ? "Preparing…" : `Share ${CARD_STYLES[activeIndex].label.toLowerCase()} card`}
          onPress={() => void handleShare()}
          busy={sharing}
          icon={<Share2 size={17} color="#ffffff" />}
        />
      </View>
    </Modal>
  );
}
