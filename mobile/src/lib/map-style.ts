/**
 * Shared MapLibre bits for the ride recorder and route views: the free
 * OpenStreetMap raster style (no API key) plus small GeoJSON/bounds helpers.
 */

export const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export const ROUTE_LINE_PAINT = { "line-color": "#e62025", "line-width": 4 };

/** FeatureCollection of LineStrings, one per recording run (pause-safe). */
export function routeFeatureCollection(runs: [number, number][][]): {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: Record<string, never>;
    geometry: { type: "LineString"; coordinates: [number, number][] };
  }[];
} {
  return {
    type: "FeatureCollection",
    features: runs
      .filter((run) => run.length >= 2)
      .map((run) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: run },
      })),
  };
}

/** MapLibre fit-bounds box as [west, south, east, north]. */
export function boundsFor(coordinates: [number, number][]): [number, number, number, number] {
  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/**
 * Project coordinates into an SVG polyline "points" string for share-card
 * renders (line-only and photo-overlay styles): lon/lat are normalized to
 * the target box with even padding, preserving aspect ratio.
 */
export function projectToPath(
  coordinates: [number, number][],
  width: number,
  height: number,
  padding = 28,
): string {
  if (coordinates.length === 0) return "";
  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const spanLon = Math.max(maxLon - minLon, 1e-6);
  const spanLat = Math.max(maxLat - minLat, 1e-6);

  // Scale to fit while keeping geography's shape (single scale factor).
  const drawableW = width - padding * 2;
  const drawableH = height - padding * 2;
  const scale = Math.min(drawableW / spanLon, drawableH / spanLat);
  const offsetX = (width - spanLon * scale) / 2;
  const offsetY = (height - spanLat * scale) / 2;

  return coordinates
    .map(([lon, lat]) => {
      const x = offsetX + (lon - minLon) * scale;
      // Latitude increases northward; SVG y grows downward — flip it.
      const y = offsetY + (maxLat - lat) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
