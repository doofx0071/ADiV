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
