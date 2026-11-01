/**
 * GPS track utilities for the ride recorder: point filtering, haversine
 * distance, and Google encoded-polyline codec. Pure functions, no React
 * Native imports (shared between the mobile app and web).
 */

export interface TrackPoint {
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lon: number;
  /** GPS accuracy in meters (lower is better). */
  accuracy?: number;
  /** Speed in m/s as reported by the GPS fix. */
  speed?: number;
  /** Fix timestamp in ms. */
  ts: number;
  /** Recording run (incremented after pause/resume so gaps don't connect). */
  runId?: number;
}

/** Points worse than this are discarded outright. */
export const MAX_ACCURACY_METERS = 50;

/**
 * Decide whether a candidate point joins the track.
 * Returns false when: accuracy is missing/worse than the gate, the fix is a
 * duplicate timestamp, or the jump from the previous point is physically
 * impossible for a scooter (> 180 km/h ≈ 50 m/s).
 */
export function shouldAcceptPoint(
  prev: TrackPoint | null,
  candidate: TrackPoint,
  maxAccuracyMeters: number = MAX_ACCURACY_METERS,
): boolean {
  if (candidate.accuracy !== undefined && candidate.accuracy > maxAccuracyMeters) return false;
  if (prev && candidate.ts <= prev.ts) return false;
  if (prev) {
    const seconds = (candidate.ts - prev.ts) / 1000;
    if (seconds > 0) {
      const meters = haversineMeters(prev, candidate);
      if (meters / seconds > 50) return false;
    }
  }
  return true;
}

/** Great-circle distance between two points, in meters. */
export function haversineMeters(a: Pick<TrackPoint, "lat" | "lon">, b: Pick<TrackPoint, "lat" | "lon">): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(Math.sqrt(h), 1));
}

/** Total distance in kilometers, summing consecutive same-run pairs only. */
export function trackDistanceKm(points: TrackPoint[]): number {
  let meters = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].runId !== points[i - 1].runId) continue;
    meters += haversineMeters(points[i - 1], points[i]);
  }
  return meters / 1000;
}

/**
 * Encode coordinates as a Google encoded polyline (precision 5) — the
 * compact string stored on the ride document.
 */
export function encodePolyline(coordinates: [number, number][]): string {
  let result = "";
  let prevLat = 0;
  let prevLon = 0;

  for (const [lon, lat] of coordinates) {
    const latRound = Math.round(lat * 1e5);
    const lonRound = Math.round(lon * 1e5);
    result += encodeValue(latRound - prevLat);
    result += encodeValue(lonRound - prevLon);
    prevLat = latRound;
    prevLon = lonRound;
  }
  return result;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}

/** Decode a Google encoded polyline back into [lon, lat] pairs. */
export function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    const [latDelta, nextIndex] = decodeValue(encoded, index);
    const [lonDelta, nextIndex2] = decodeValue(encoded, nextIndex);
    index = nextIndex2;
    lat += latDelta;
    lon += lonDelta;
    coordinates.push([lon / 1e5, lat / 1e5]);
  }
  return coordinates;
}

function decodeValue(input: string, startIndex: number): [number, number] {
  let index = startIndex;
  let result = 0;
  let shift = 0;
  let byte: number;
  do {
    byte = input.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  const value = result & 1 ? ~(result >> 1) : result >> 1;
  return [value, index];
}
