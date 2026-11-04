import { requireOptionalNativeModule, type EventSubscription } from "expo-modules-core";
import { Platform } from "react-native";
import { recordMapActivity } from "./mapbox-usage";

export type MapboxRouteSource = "offline" | "online" | "unknown";

export interface MapboxNativeRoute {
  routeId: string;
  source: MapboxRouteSource;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
  steps: { text: string; distanceMeters: number; lon: number; lat: number }[];
}

export interface MapboxOfflineProgress {
  regionId: string;
  asset: "style" | "map-and-routing" | "estimate" | "complete";
  completed?: number;
  required?: number;
  percent: number;
  storageSizeBytes?: number;
  transferSizeBytes?: number;
  errorMargin?: number;
}

export interface MapboxRegionEstimate {
  storageSizeBytes: number;
  transferSizeBytes: number;
  errorMargin: number;
}

export interface MapboxOfflineRegionStatus {
  regionId: string;
  styleReady: boolean;
  mapTilesReady: boolean;
  routingTilesReady: boolean;
  tileRegionBytes?: number;
  metadataJson?: string;
  mapsSdkVersion?: string;
  navigationSdkVersion?: string;
  routingProfile?: string;
  lastUpdatedAt?: number;
}

interface MapboxBridgeModule {
  configureSharedTileStore(token: string): Promise<{ configured: boolean; mapsSdkVersion: string; navigationSdkVersion: string }>;
  prepareNavigation(token: string): Promise<string>;
  requestRoute(fromLon: number, fromLat: number, toLon: number, toLat: number, offlineOnly: boolean): Promise<MapboxNativeRoute>;
  startGuidance(routeId: string, offlineOnly: boolean): Promise<void>;
  stopGuidance(): void;
  releaseRoute(routeId: string): void;
  loadRegion(regionId: string, geometryJson: string, styleUri: string, minZoom: number, maxZoom: number): Promise<MapboxOfflineRegionStatus>;
  cancelRegion(regionId: string): void;
  estimateRegion(regionId: string, geometryJson: string, styleUri: string, minZoom: number, maxZoom: number): Promise<MapboxRegionEstimate>;
  getRegionStatus(regionId: string): Promise<MapboxOfflineRegionStatus>;
  removeRegion(regionId: string, styleUri: string): Promise<void>;
  addListener(eventName: string, listener: (payload: unknown) => void): EventSubscription;
}

const publicToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
const experimentalEnabled = process.env.EXPO_PUBLIC_MAPBOX_EXPERIMENTAL_ENABLED === "true";
const bridge = Platform.OS === "android"
  ? requireOptionalNativeModule<MapboxBridgeModule>("AdiVMapboxBridge")
  : null;
let configurePromise: Promise<void> | null = null;

export const MAPBOX_STYLE_URI = "mapbox://styles/mapbox/streets-v12";

export function hasMapboxToken(): boolean {
  return publicToken.startsWith("pk.");
}

export function isMapboxExperimentEnabled(): boolean {
  return experimentalEnabled;
}

export function isMapboxAndroidReady(): boolean {
  return Platform.OS === "android" && experimentalEnabled && hasMapboxToken() && bridge !== null;
}

export function configureMapbox(): Promise<void> {
  if (!experimentalEnabled) return Promise.reject(new Error("Mapbox is disabled. Enable the Android experiment only after reviewing the vehicle-use license and account terms."));
  if (!hasMapboxToken() || !bridge) return Promise.reject(new Error("Mapbox Android needs its native bridge and a public EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN starting with pk."));
  if (!configurePromise) {
    configurePromise = (async () => {
      await bridge.configureSharedTileStore(publicToken);
      const { setMapboxAccessToken } = await import("./mapbox-sdk");
      setMapboxAccessToken(publicToken);
    })().catch((error: unknown) => {
      configurePromise = null;
      throw error;
    });
  }
  return configurePromise;
}

export async function prepareMapboxNavigation(): Promise<void> {
  if (!bridge) throw new Error("The Android Mapbox bridge is not installed in this build.");
  await configureMapbox();
  await bridge.prepareNavigation(publicToken);
}

export async function requestMapboxRoute(
  from: [number, number],
  to: [number, number],
  options: { offlineOnly?: boolean; signal?: AbortSignal } = {},
): Promise<MapboxNativeRoute> {
  if (!bridge) throw new Error("Mapbox navigation is available in Android development and release builds only.");
  await prepareMapboxNavigation();
  const route = await bridge.requestRoute(from[0], from[1], to[0], to[1], options.offlineOnly === true);
  if (options.signal?.aborted) {
    bridge.releaseRoute(route.routeId);
    throw new Error("Route request canceled.");
  }
  void recordMapActivity("routeRequestSucceeded");
  return route;
}

export async function startMapboxGuidance(routeId: string, offlineOnly: boolean): Promise<void> {
  if (!bridge) throw new Error("Mapbox navigation is unavailable in this build.");
  await prepareMapboxNavigation();
  await bridge.startGuidance(routeId, offlineOnly);
  void recordMapActivity("guidanceStartSucceeded");
}

export function stopMapboxGuidance(): void {
  bridge?.stopGuidance();
  if (bridge) void recordMapActivity("guidanceStopRequested");
}

export function releaseMapboxRoute(routeId: string | undefined): void {
  if (routeId) bridge?.releaseRoute(routeId);
}

export function addMapboxListener<T>(eventName: string, listener: (payload: T) => void): EventSubscription | null {
  if (!bridge) return null;
  return bridge.addListener(eventName, listener as (payload: unknown) => void);
}

export function loadMapboxRegion(input: {
  regionId: string;
  geometry: GeoJSON.Polygon;
  styleUri?: string;
  minZoom?: number;
  maxZoom?: number;
}): Promise<MapboxOfflineRegionStatus> {
  if (!bridge) return Promise.reject(new Error("Mapbox offline regions are available in Android builds only."));
  return configureMapbox().then(() => {
    void recordMapActivity("offlineRegionLoadRequested");
    return bridge.loadRegion(
      input.regionId,
      JSON.stringify(input.geometry),
      input.styleUri ?? MAPBOX_STYLE_URI,
      input.minZoom ?? 6,
      input.maxZoom ?? 16,
    );
  });
}

export function cancelMapboxRegion(regionId: string): void {
  bridge?.cancelRegion(regionId);
}

export function estimateMapboxRegion(input: {
  regionId: string;
  geometry: GeoJSON.Polygon;
  styleUri?: string;
  minZoom?: number;
  maxZoom?: number;
}): Promise<MapboxRegionEstimate> {
  if (!bridge) return Promise.reject(new Error("Mapbox offline-region estimates are available in Android builds only."));
  return configureMapbox().then(() => bridge.estimateRegion(
    input.regionId,
    JSON.stringify(input.geometry),
    input.styleUri ?? MAPBOX_STYLE_URI,
    input.minZoom ?? 6,
    input.maxZoom ?? 16,
  ));
}

export async function getMapboxRegionStatus(regionId: string): Promise<MapboxOfflineRegionStatus> {
  if (!bridge) return { regionId, styleReady: false, mapTilesReady: false, routingTilesReady: false };
  await configureMapbox();
  return bridge.getRegionStatus(regionId);
}

export async function removeMapboxRegion(regionId: string, styleUri = MAPBOX_STYLE_URI): Promise<void> {
  if (!bridge) throw new Error("Mapbox offline regions are available in Android builds only.");
  await configureMapbox();
  await bridge.removeRegion(regionId, styleUri);
}

export function onMapboxOfflineProgress(listener: (event: MapboxOfflineProgress) => void): EventSubscription | null {
  return addMapboxListener("onOfflineProgress", listener);
}

export function onMapboxRouteProgress(listener: (event: { distanceRemaining: number; stepDistanceRemaining: number; instruction: string; legIndex: number }) => void): EventSubscription | null {
  return addMapboxListener("onRouteProgress", listener);
}

export function onMapboxRouteChanged(listener: (route: MapboxNativeRoute) => void): EventSubscription | null {
  return addMapboxListener("onRouteChanged", listener);
}

export function onMapboxOffRoute(listener: (event: { offRoute: boolean }) => void): EventSubscription | null {
  return addMapboxListener("onOffRoute", listener);
}

export function onMapboxArrival(listener: (event: { waypointIndex: number; isFinalDestination: boolean }) => void): EventSubscription | null {
  return addMapboxListener("onArrival", listener);
}

export function onMapboxVoiceInstruction(listener: (event: { text: string }) => void): EventSubscription | null {
  return addMapboxListener("onVoiceInstruction", listener);
}

export function onMapboxGuidanceError(listener: (event: { message: string }) => void): EventSubscription | null {
  return addMapboxListener("onGuidanceError", listener);
}
