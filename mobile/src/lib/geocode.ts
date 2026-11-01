/**
 * Free place search over Nominatim (OpenStreetMap) — no API key. Light
 * personal use respects their usage policy; results are Philippines-scoped
 * since that's where AdiV rides happen.
 */

export interface PlaceResult {
  label: string;
  lat: number;
  lon: number;
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?format=json&limit=5&countrycodes=ph&addressdetails=0&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Place search is unavailable right now.");
  }
  const json = (await response.json()) as { display_name: string; lat: string; lon: string }[];
  return json.map((entry) => ({
    label: entry.display_name,
    lat: Number(entry.lat),
    lon: Number(entry.lon),
  }));
}
