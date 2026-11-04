import { forwardRef, useImperativeHandle, useRef, type ComponentRef, type Ref } from "react";
import { Map as MapLibreView, Camera as MapLibreCamera, GeoJSONSource, Layer, UserLocation as MapLibreUserLocation, type CameraRef as MapLibreCameraRef } from "@maplibre/maplibre-react-native";
import Mapbox, { Camera as MapboxCamera, LineLayer, ShapeSource, UserLocation as MapboxUserLocation } from "@rnmapbox/maps";
import type { MapState as MapboxMapState } from "@rnmapbox/maps";
import type { ViewStyle } from "react-native";
import { ROUTE_LINE_PAINT } from "@/lib/map-style";
import { recordMapActivity } from "@/lib/mapbox-usage";

export interface RideCameraHandle {
  easeTo(options: { center: [number, number]; zoom: number; pitch?: number; duration?: number }): void;
  fitBounds(bounds: [number, number, number, number], options?: { padding?: { top: number; right: number; bottom: number; left: number }; duration?: number }): void;
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
  {
    provider,
    styleURL,
    mapLibreStyle,
    style,
    cameraMode,
    planned = false,
    bounds,
    center,
    actualRoute,
    plannedRoute,
    destination,
    destinationColor,
    onLongPress,
    onUserInteraction,
    cameraRef,
  },
  forwardedRef,
) {
  const mapboxMapRef = useRef<ComponentRef<typeof Mapbox.MapView>>(null);
  const maplibreMapRef = useRef<ComponentRef<typeof MapLibreView>>(null);
  const mapboxCameraRef = useRef<ComponentRef<typeof MapboxCamera>>(null);
  const maplibreCameraRef = useRef<MapLibreCameraRef>(null);

  useImperativeHandle(cameraRef, () => ({
    easeTo: ({ center: coordinate, zoom, pitch = 0, duration = 400 }) => {
      if (provider === "mapbox") {
        mapboxCameraRef.current?.setCamera({
          centerCoordinate: coordinate,
          zoomLevel: zoom,
          pitch,
          animationMode: "easeTo",
          animationDuration: duration,
        });
      } else {
        maplibreCameraRef.current?.easeTo({ center: coordinate, zoom, pitch, duration });
      }
    },
    fitBounds: (cameraBounds, options) => {
      const [west, south, east, north] = cameraBounds;
      const padding = options?.padding;
      if (provider === "mapbox") {
        mapboxCameraRef.current?.setCamera({
          bounds: {
            ne: [east, north],
            sw: [west, south],
            paddingTop: padding?.top ?? 40,
            paddingRight: padding?.right ?? 40,
            paddingBottom: padding?.bottom ?? 40,
            paddingLeft: padding?.left ?? 40,
          },
          animationMode: "easeTo",
          animationDuration: options?.duration ?? 0,
        });
      } else {
        maplibreCameraRef.current?.fitBounds(cameraBounds, {
          padding: padding ?? { top: 40, right: 40, bottom: 40, left: 40 },
          duration: options?.duration ?? 0,
        });
      }
    },
  }), [provider]);

  useImperativeHandle(forwardedRef, () => ({
    getCenter: async () => {
      if (provider === "mapbox") {
        const value = await mapboxMapRef.current?.getCenter();
        if (!value) throw new Error("The Mapbox map is not ready.");
        return value as [number, number];
      }
      const value = await maplibreMapRef.current?.getCenter();
      if (!value) throw new Error("The MapLibre map is not ready.");
      return value;
    },
  }), [provider]);

  const renderMapboxLongPress = async (feature: GeoJSON.Feature<GeoJSON.Point, { screenPointX: number; screenPointY: number }>) => {
    if (!onLongPress) return;
    const coordinate = await mapboxMapRef.current?.getCoordinateFromView([
      feature.properties.screenPointX,
      feature.properties.screenPointY,
    ]);
    if (coordinate) onLongPress({ nativeEvent: { lngLat: coordinate as [number, number] } });
  };

  if (provider === "mapbox") {
    const mapboxCameraBounds = bounds
      ? {
          ne: [bounds[2], bounds[3]] as [number, number],
          sw: [bounds[0], bounds[1]] as [number, number],
          paddingTop: 40,
          paddingRight: 40,
          paddingBottom: 40,
          paddingLeft: 40,
        }
      : undefined;
    return (
      <Mapbox.MapView
        ref={mapboxMapRef}
        styleURL={styleURL}
        style={style}
        attributionEnabled
        logoEnabled
        onDidFinishLoadingMap={() => { void recordMapActivity("mapboxMapStyleLoaded"); }}
        onLongPress={(feature) => void renderMapboxLongPress(feature)}
        onCameraChanged={(state: MapboxMapState) => {
          if (state.gestures.isGestureActive) onUserInteraction?.();
        }}
      >
        {cameraMode === "course" ? (
          <MapboxCamera ref={mapboxCameraRef} followUserLocation followUserMode={Mapbox.UserTrackingMode.FollowWithCourse} followZoomLevel={planned ? 15 : 16} followPitch={planned ? 32 : 45} />
        ) : cameraMode === "follow" ? (
          <MapboxCamera ref={mapboxCameraRef} followUserLocation followUserMode={Mapbox.UserTrackingMode.Follow} followZoomLevel={15} />
        ) : cameraMode === "bounds" && mapboxCameraBounds ? (
          <MapboxCamera ref={mapboxCameraRef} bounds={mapboxCameraBounds} />
        ) : cameraMode === "center" && center ? (
          <MapboxCamera ref={mapboxCameraRef} centerCoordinate={center} zoomLevel={16} pitch={0} />
        ) : (
          <MapboxCamera ref={mapboxCameraRef} />
        )}
        <ShapeSource id="actualRouteSource" shape={actualRoute}>
          <LineLayer id="actualRouteLine" style={{ lineColor: ROUTE_LINE_PAINT["line-color"], lineWidth: ROUTE_LINE_PAINT["line-width"] }} />
        </ShapeSource>
        {plannedRoute ? (
          <ShapeSource id="plannedRouteSource" shape={plannedRoute}>
            <LineLayer id="plannedRouteLine" style={{ lineColor: ROUTE_LINE_PAINT["line-color"], lineWidth: 5, lineOpacity: 0.75 }} />
          </ShapeSource>
        ) : null}
        {destination ? (
          <ShapeSource id="destinationSource" shape={{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: destination } }}>
            <Mapbox.CircleLayer id="destinationPin" style={{ circleRadius: 8, circleColor: destinationColor, circleStrokeWidth: 3, circleStrokeColor: "#ffffff" }} />
          </ShapeSource>
        ) : null}
        <MapboxUserLocation visible />
      </Mapbox.MapView>
    );
  }

  return (
    <MapLibreView
      ref={maplibreMapRef}
      mapStyle={mapLibreStyle}
      style={style}
      onDidFinishLoadingMap={() => { void recordMapActivity("mapLibreMapStyleLoaded"); }}
      onLongPress={onLongPress}
      onRegionWillChange={(event) => {
        if (event.nativeEvent.userInteraction) onUserInteraction?.();
      }}
    >
      {cameraMode === "course" ? (
        <MapLibreCamera ref={maplibreCameraRef} trackUserLocation="course" zoom={planned ? 15 : 16} pitch={planned ? 32 : 45} />
      ) : cameraMode === "follow" ? (
        <MapLibreCamera ref={maplibreCameraRef} trackUserLocation="default" zoom={15} />
      ) : cameraMode === "bounds" && bounds ? (
        <MapLibreCamera ref={maplibreCameraRef} bounds={bounds} padding={{ top: 40, right: 40, bottom: 40, left: 40 }} />
      ) : cameraMode === "center" && center ? (
        <MapLibreCamera ref={maplibreCameraRef} center={center} zoom={16} pitch={0} />
      ) : (
        <MapLibreCamera ref={maplibreCameraRef} />
      )}
      <GeoJSONSource id="routeSource" data={actualRoute}>
        <Layer id="routeLine" type="line" paint={ROUTE_LINE_PAINT} />
      </GeoJSONSource>
      {plannedRoute ? (
        <GeoJSONSource id="plannedSource" data={plannedRoute}>
          <Layer id="plannedLine" type="line" paint={{ ...ROUTE_LINE_PAINT, "line-width": 5 }} />
        </GeoJSONSource>
      ) : null}
      {destination ? (
        <GeoJSONSource id="destinationSource" data={{ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: destination } }] }}>
          <Layer id="destinationPin" type="circle" paint={{ "circle-radius": 8, "circle-color": destinationColor, "circle-stroke-width": 3, "circle-stroke-color": "#ffffff" }} />
        </GeoJSONSource>
      ) : null}
      <MapLibreUserLocation />
    </MapLibreView>
  );
});
