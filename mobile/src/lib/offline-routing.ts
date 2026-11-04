export interface OfflineRouteCoordinate {
  lat: number;
  lon: number;
}

export interface OfflineRouteInstruction {
  text: string;
  distanceMeters: number;
  location: OfflineRouteCoordinate;
}

export interface OfflineRouteResult {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: OfflineRouteCoordinate[];
  instructions: OfflineRouteInstruction[];
  warnings: string[];
}

/**
 * Contract for the Android Valhalla bridge. No implementation is exposed until
 * the selected engine and graph pass the physical-device airplane-mode gate.
 */
export interface OfflineRoutingModule {
  loadGraph(input: { graphUri: string; packVersion: string; engineVersion: string }): Promise<void>;
  calculateRoute(request: OfflineRoutingRequest): Promise<OfflineRouteResult>;
  cancelRoute(requestId: string): Promise<void>;
  unloadGraph(): Promise<void>;
}

export interface OfflineRoutingRequest {
  requestId: string;
  from: OfflineRouteCoordinate;
  to: OfflineRouteCoordinate;
  profile: "motorcycle" | "car";
  avoidFerries?: boolean;
}

export const OFFLINE_ROUTING_STATUS = "deferred-unverified" as const;

export function getOfflineRoutingModule(): OfflineRoutingModule | null {
  return null;
}
