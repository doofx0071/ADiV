import { forwardRef, useImperativeHandle, type Ref } from "react";
import { Text, View, type ViewStyle } from "react-native";

export interface RideCameraHandle {
  easeTo(options: { center: [number, number]; zoom: number; pitch?: number; duration?: number }): void;
  fitBounds(
    bounds: [number, number, number, number],
    options?: { padding?: { top: number; right: number; bottom: number; left: number }; duration?: number },
  ): void;
}

export interface RideMapHandle {
  getCenter(): Promise<[number, number]>;
}

type CameraMode = "course" | "follow" | "bounds" | "center" | "free";

interface Props {
  provider: "mapbox" | "maplibre";
  styleURL?: string;
  mapLibreStyle: string;
  style: ViewStyle;
  cameraMode: CameraMode;
  planned?: boolean;
  bounds?: [number, number, number, number] | null;
  center?: [number, number] | null;
  actualRoute: GeoJSON.FeatureCollection;
  plannedRoute?: GeoJSON.FeatureCollection;
  destination?: [number, number] | null;
  destinationColor: string;
  onLongPress?: (event: { nativeEvent: { lngLat: [number, number] } }) => void;
  onUserInteraction?: () => void;
}

export const RideMap = forwardRef<RideMapHandle, Props & { cameraRef: Ref<RideCameraHandle> }>(function RideMap(
  { style, center, bounds, cameraRef },
  forwardedRef,
) {
  useImperativeHandle(cameraRef, () => ({
    easeTo: () => undefined,
    fitBounds: () => undefined,
  }), []);

  useImperativeHandle(forwardedRef, () => ({
    getCenter: async () => {
      if (center) return center;
      if (bounds) return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
      throw new Error("Map preview is unavailable in the web build.");
    },
  }), [bounds, center]);

  return (
    <View
      accessibilityLabel="Map preview unavailable in web build"
      style={[style, { alignItems: "center", justifyContent: "center", backgroundColor: "#e8e9e6" }]}
    >
      <Text style={{ color: "#565a56", fontSize: 14 }}>Map preview is available in the Android app.</Text>
    </View>
  );
});
