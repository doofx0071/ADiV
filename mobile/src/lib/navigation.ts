/**
 * Free turn-by-turn navigation over the OSRM HTTP API.
 *
 * Base URL defaults to the public demo server (rate-limited, no SLA — fine
 * for a personal app). Point OSRM_BASE at a self-hosted OSRM for unlimited
 * use; the API shape is identical.
 */
import { decodePolyline, haversineMeters } from "./shared";

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
}

/** Distance (m) from the current fix to a step that triggers its voice callout. */
export const SPEAK_DISTANCE_METERS = 40;

export async function planRoute(
  from: [number, number],
  to: [number, number],
): Promise<PlannedRoute> {
  const url = `${OSRM_BASE}/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=polyline&steps=true`;
  const response = await fetch(url);
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
  };
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
