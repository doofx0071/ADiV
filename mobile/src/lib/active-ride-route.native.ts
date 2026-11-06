import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PlaceResult } from "./geocode";
import type { PlannedRoute } from "./navigation";

const ACTIVE_RIDE_ROUTE_KEY = "adiv-active-ride-route-v1";

export type PersistedRideRoute = Omit<PlannedRoute, "routeId">;

export interface ActiveRideRouteState {
  destination: PlaceResult;
  planned: PersistedRideRoute | null;
}

function isCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === "number"
    && Number.isFinite(value[0])
    && value[0] >= -180
    && value[0] <= 180
    && typeof value[1] === "number"
    && Number.isFinite(value[1])
    && value[1] >= -90
    && value[1] <= 90;
}

function parseRouteState(raw: string): ActiveRideRouteState | null {
  try {
    const value = JSON.parse(raw) as Partial<ActiveRideRouteState>;
    const destination = value.destination;
    if (!destination || typeof destination.label !== "string"
      || typeof destination.lat !== "number" || !Number.isFinite(destination.lat)
      || destination.lat < -90 || destination.lat > 90
      || typeof destination.lon !== "number" || !Number.isFinite(destination.lon)
      || destination.lon < -180 || destination.lon > 180) return null;

    const route = value.planned;
    if (route === null || route === undefined) return { destination, planned: null };
    if (!Array.isArray(route.coordinates) || route.coordinates.length < 2
      || route.coordinates.length > 20_000 || !route.coordinates.every(isCoordinate)
      || !Array.isArray(route.steps)
      || !route.steps.every((step) => typeof step.text === "string"
        && Number.isFinite(step.distanceMeters)
        && Number.isFinite(step.lon)
        && Number.isFinite(step.lat))
      || !Number.isFinite(route.distanceKm)
      || !Number.isFinite(route.durationMinutes)
      || (route.provider !== "online-osrm" && route.provider !== "mapbox-navigation")) return null;

    return {
      destination,
      planned: {
        coordinates: route.coordinates,
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        steps: route.steps,
        provider: route.provider,
        ...(route.routeSource ? { routeSource: route.routeSource } : {}),
        ...(route.offlineOnly === true ? { offlineOnly: true } : {}),
      },
    };
  } catch {
    return null;
  }
}

export async function saveActiveRideRoute(state: ActiveRideRouteState): Promise<void> {
  const planned = state.planned ? {
    coordinates: state.planned.coordinates,
    distanceKm: state.planned.distanceKm,
    durationMinutes: state.planned.durationMinutes,
    steps: state.planned.steps,
    provider: state.planned.provider,
    ...(state.planned.routeSource ? { routeSource: state.planned.routeSource } : {}),
    ...(state.planned.offlineOnly === true ? { offlineOnly: true } : {}),
  } : null;
  await AsyncStorage.setItem(ACTIVE_RIDE_ROUTE_KEY, JSON.stringify({ destination: state.destination, planned }));
}

export async function loadActiveRideRoute(): Promise<ActiveRideRouteState | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_RIDE_ROUTE_KEY);
  return raw ? parseRouteState(raw) : null;
}

export async function clearActiveRideRoute(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_RIDE_ROUTE_KEY);
}
