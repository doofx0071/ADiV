/**
 * Route-planning adapter. The opt-in Android experiment uses Mapbox Navigation;
 * other builds fall back to the public OSRM driving endpoint, which is
 * rate-limited and has no SLA.
 */
import { decodePolyline, haversineMeters } from "./shared";
import { createTimedAbortSignal } from "./request-timeout";
import { isMapboxAndroidReady, requestMapboxRoute, type MapboxRouteSource } from "./mapbox-bridge";

const OSRM_BASE = "https://router.project-osrm.org";

export interface NavStep {
  text: string;
  distanceMeters: number;
  lon: number;
  lat: number;
}

export interface PlannedRoute {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  steps: NavStep[];
  provider: "online-osrm" | "mapbox-navigation";
  routeId?: string;
  routeSource?: MapboxRouteSource;
  offlineOnly?: boolean;
}

/** Distance (m) from the current fix to a step that triggers its voice callout. */
export const SPEAK_DISTANCE_METERS = 40;

export async function planRoute(
  from: [number, number],
  to: [number, number],
  options: { signal?: AbortSignal; offlineOnly?: boolean } = {},
): Promise<PlannedRoute> {
  if (isMapboxAndroidReady()) {
    const route = await requestMapboxRoute(from, to, options);
    return {
      coordinates: route.coordinates,
      distanceKm: route.distanceMeters / 1000,
      durationMinutes: route.durationSeconds / 60,
      steps: route.steps,
      provider: "mapbox-navigation",
      routeId: route.routeId,
      routeSource: route.source,
      offlineOnly: options.offlineOnly === true,
    };
  }
  if (options.offlineOnly) {
    throw new Error("Offline turn-by-turn navigation needs Mapbox Navigation tiles and an Android Mapbox build. No online router was used.");
  }
  const url = `${OSRM_BASE}/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=polyline&steps=true`;
  const request = createTimedAbortSignal(12_000, options.signal);
  try {
    const response = await fetch(url, { signal: request.signal });
    if (!response.ok) {
      throw new Error("The routing service is unavailable right now. Try again shortly.");
    }
    const json = (await response.json()) as {
      code?: string;
      routes?: {
        distance: number;
        duration: number;
        geometry: string;
        legs?: {
          steps?: {
            distance: number;
            name?: string;
            maneuver: { type: string; modifier?: string; location: [number, number] };
          }[];
        }[];
      }[];
    };
    const route = json.routes?.[0];
    if (!route) throw new Error("No road route found to that destination.");

    const steps: NavStep[] = [];
    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const text = maneuverText(step.maneuver.type, step.maneuver.modifier, step.name);
        if (text) {
          steps.push({
            text,
            distanceMeters: step.distance,
            lon: step.maneuver.location[0],
            lat: step.maneuver.location[1],
          });
        }
      }
    }

    return {
      coordinates: decodePolyline(route.geometry),
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      steps,
      provider: "online-osrm",
    };
  } catch (error) {
    if (request.didTimeout()) {
      throw new Error("The online routing service took too long to respond. Try again when your connection is stronger.");
    }
    throw error;
  } finally {
    request.dispose();
  }
}

export const OFF_ROUTE_DISTANCE_METERS = 120;
export const OFF_ROUTE_CONFIRMATION_FIXES = 3;
export const REROUTE_COOLDOWN_MS = 45_000;

export interface RerouteHysteresisState {
  consecutiveOffRouteFixes: number;
  lastRerouteAt: number;
}

export function updateRerouteHysteresis(
  state: RerouteHysteresisState,
  distanceMeters: number,
  now: number,
  isRouting = false,
): { state: RerouteHysteresisState; shouldReroute: boolean } {
  if (isRouting || distanceMeters <= OFF_ROUTE_DISTANCE_METERS) {
    return { state: { ...state, consecutiveOffRouteFixes: 0 }, shouldReroute: false };
  }
  const consecutiveOffRouteFixes = state.consecutiveOffRouteFixes + 1;
  if (
    consecutiveOffRouteFixes >= OFF_ROUTE_CONFIRMATION_FIXES &&
    now - state.lastRerouteAt >= REROUTE_COOLDOWN_MS
  ) {
    return { state: { consecutiveOffRouteFixes: 0, lastRerouteAt: now }, shouldReroute: true };
  }
  return { state: { ...state, consecutiveOffRouteFixes }, shouldReroute: false };
}

/** Approximate distance to the nearest route segment in a local metric plane. */
export function distanceToRouteMeters(point: [number, number], route: [number, number][]): number {
  if (route.length === 0) return Number.POSITIVE_INFINITY;
  if (route.length === 1) return pointDistanceMeters(point, route[0]);
  const latitudeScale = 110_574;
  const longitudeScale = 111_320 * Math.cos((point[1] * Math.PI) / 180);
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.length; index += 1) {
    const [startLon, startLat] = route[index - 1];
    const [endLon, endLat] = route[index];
    const ax = (startLon - point[0]) * longitudeScale;
    const ay = (startLat - point[1]) * latitudeScale;
    const bx = (endLon - point[0]) * longitudeScale;
    const by = (endLat - point[1]) * latitudeScale;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const nearestX = ax + projection * dx;
    const nearestY = ay + projection * dy;
    minimum = Math.min(minimum, Math.hypot(nearestX, nearestY));
  }
  return minimum;
}

function pointDistanceMeters(first: [number, number], second: [number, number]): number {
  const latitudeScale = 110_574;
  const longitudeScale = 111_320 * Math.cos((first[1] * Math.PI) / 180);
  return Math.hypot((first[0] - second[0]) * longitudeScale, (first[1] - second[1]) * latitudeScale);
}

function maneuverText(type: string, modifier: string | undefined, road: string | undefined): string | null {
  const onto = road ? ` onto ${road}` : "";
  switch (type) {
    case "depart":
      return "Head out";
    case "arrive":
      return "You have arrived";
    case "turn":
      return `Turn ${spokenModifier(modifier)}${onto}`;
    case "new name":
      return `Continue${onto}`;
    case "merge":
      return `Merge ${spokenModifier(modifier)}${onto}`;
    case "fork":
      return `Keep ${spokenModifier(modifier)} at the fork${onto}`;
    case "end of road":
      return `Turn ${spokenModifier(modifier)} at the end of the road${onto}`;
    case "roundabout":
    case "rotary":
      return `Take the roundabout${onto}`;
    default:
      return `Continue${onto}`;
  }
}

function spokenModifier(modifier: string | undefined): string {
  switch (modifier) {
    case "slight left":
      return "slightly left";
    case "slight right":
      return "slightly right";
    case "sharp left":
      return "sharp left";
    case "sharp right":
      return "sharp right";
    case "straight":
      return "straight";
    default:
      return modifier ?? "";
  }
}

/**
 * Distance in meters from a position to the given step location — the "turn
 * in X meters" figure shown in the guidance banner.
 */
export function metersToStep(position: [number, number], step: NavStep): number {
  return haversineMeters(
    { lat: position[1], lon: position[0] },
    { lat: step.lat, lon: step.lon },
  );
}
