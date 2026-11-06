import type { PlaceResult } from "./geocode";
import type { PlannedRoute } from "./navigation";

export type PersistedRideRoute = Omit<PlannedRoute, "routeId">;

export interface ActiveRideRouteState {
  destination: PlaceResult;
  planned: PersistedRideRoute | null;
}

export async function saveActiveRideRoute(_state: ActiveRideRouteState): Promise<void> {}
export async function loadActiveRideRoute(): Promise<ActiveRideRouteState | null> { return null; }
export async function clearActiveRideRoute(): Promise<void> {}
