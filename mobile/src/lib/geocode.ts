/** Online OpenStreetMap place search. MapLibre draws the map; Photon searches it. */
import { createTimedAbortSignal } from "./request-timeout";

export interface PlaceResult {
  label: string;
  detail?: string;
  lat: number;
  lon: number;
  source?: "offline" | "online" | "offline+online";
}

interface PhotonFeature {
  properties?: {
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    type?: string;
    osm_key?: string;
    osm_value?: string;
  };
  geometry?: { coordinates?: [number, number] };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

function queryVariants(query: string): string[] {
  const variants = [query.trim()];
  // Photon matches the OSM name “Six Eleven Global Services” when the joined
  // brand word is separated. Keep the user's original query as the first try.
  const expanded = query.replace(/\bsixeleven\b/gi, "Six Eleven").trim();
  if (expanded && expanded.toLocaleLowerCase() !== variants[0].toLocaleLowerCase()) variants.push(expanded);
  return variants;
}

function mapPhotonFeature(feature: PhotonFeature): PlaceResult | null {
  const [lon, lat] = feature.geometry?.coordinates ?? [];
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const properties = feature.properties ?? {};
  const label = properties.name?.trim() || properties.street?.trim();
  if (!label) return null;
  const address = [properties.street, properties.district, properties.city, properties.county, properties.state]
    .map((part) => part?.trim())
    .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);
  const kind = [properties.osm_key, properties.osm_value]
    .filter(Boolean)
    .slice(-1)[0]
    ?.replaceAll("_", " ");
  if (kind && !address.some((part) => part.toLocaleLowerCase() === kind.toLocaleLowerCase())) address.push(kind);
  return { label, detail: address.join(" · "), lat, lon, source: "online" };
}

export async function searchPlaces(
  query: string,
  options: { signal?: AbortSignal; position?: [number, number] } = {},
): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const request = createTimedAbortSignal(8_000, options.signal);
  try {
    for (const variant of queryVariants(trimmed)) {
      const params = new URLSearchParams({ q: variant, limit: "8", lang: "en", countrycode: "PH" });
      const [lon, lat] = options.position ?? [];
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        params.set("lat", String(lat));
        params.set("lon", String(lon));
      }
      const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal: request.signal,
      });
      if (!response.ok) throw new Error("Online OpenStreetMap place search is unavailable right now.");
      const json = (await response.json()) as PhotonResponse;
      const results = (json.features ?? []).map(mapPhotonFeature).filter((entry): entry is PlaceResult => entry !== null);
      if (results.length > 0) return results;
    }
    return [];
  } catch (error) {
    if (request.didTimeout()) throw new Error("Online place search timed out. Offline matches remain available.");
    throw error;
  } finally {
    request.dispose();
  }
}
