import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  isSafePackPath,
  makeFtsQuery,
  parseOfflinePackManifest,
  resolveOfflineStyle,
  validateOfflineStyle,
} from "../mobile/src/lib/offline-pack-contract";

const checksum = "0".repeat(64);

function manifest() {
  const files = [
    "map/davao.pmtiles",
    "search/places.sqlite",
    "search/pois.geojson",
    "style/style.json",
    "style/glyphs/Noto Sans Regular/0-255.pbf",
    "style/sprites/sprite.json",
    "style/sprites/sprite.png",
    "style/LICENSES.md",
  ].map((path) => ({ path, sha256: checksum, bytes: 1 }));
  return {
    format: "adiv-offline-pack",
    manifestVersion: 1,
    packId: "ph-davao",
    version: "1.0.0",
    name: "Davao sample",
    region: "davao",
    dataDate: "2026-10-31",
    minimumAppVersion: "1.3.2",
    attribution: "© OpenStreetMap contributors · Data available under ODbL-1.0",
    source: { provider: "Geofabrik", pbfDate: "2026-10-31", pbfMd5: "0".repeat(32) },
    licenses: [
      { component: "OpenStreetMap data", license: "ODbL-1.0", attribution: "© OpenStreetMap contributors" },
    ],
    coverage: [125.2, 6.8, 125.75, 7.45],
    mapSchema: "shortbread-1.1",
    searchSchemaVersion: 2,
    assets: {
      map: "map/davao.pmtiles",
      search: "search/places.sqlite",
      poi: "search/pois.geojson",
      style: "style/style.json",
      glyphsDir: "style/glyphs",
      sprite: "style/sprites/sprite",
    },
    files,
  };
}

const style = JSON.stringify({
  version: 8,
  name: "ADiV Shortbread offline",
  glyphs: "__ADIV_GLYPHS_URI__/{fontstack}/{range}.pbf",
  sprite: "__ADIV_SPRITE_URI__",
  sources: {
    shortbread: { type: "vector", url: "pmtiles://__ADIV_MAP_URI__" },
    adivPois: { type: "geojson", data: "__ADIV_POI_URI__" },
  },
  layers: [
    { id: "background", type: "background" },
    { id: "water", type: "fill", source: "shortbread", "source-layer": "water" },
    { id: "street-labels", type: "symbol", source: "shortbread", "source-layer": "street_labels" },
    { id: "search-poi-labels", type: "symbol", source: "adivPois" },
  ],
});

describe("offline map pack contract", () => {
  it("accepts versioned, checksummed pack metadata with local style assets", () => {
    const parsed = parseOfflinePackManifest(manifest());
    expect(parsed.packId).toBe("ph-davao");
    expect(validateOfflineStyle(style).version).toBe(8);
    const resolved = resolveOfflineStyle(style, "file:///data/packs/ph-davao/1.0.0", parsed);
    expect(resolved).toContain("pmtiles://file:///data/packs/ph-davao/1.0.0/map/davao.pmtiles");
    expect(resolved).toContain("file:///data/packs/ph-davao/1.0.0/search/pois.geojson");
    expect(resolved).toContain("file:///data/packs/ph-davao/1.0.0/style/glyphs");
  });

  it("rejects traversal, unlisted files, and remote style sources", () => {
    expect(isSafePackPath("style/glyphs/0-255.pbf")).toBe(true);
    expect(isSafePackPath("../outside")).toBe(false);
    expect(isSafePackPath("style\\outside")).toBe(false);
    expect(() => parseOfflinePackManifest({ ...manifest(), files: [...manifest().files, { path: "map", sha256: checksum, bytes: 1 }] })).toThrow("conflicts with a folder");
    expect(() => validateOfflineStyle(style.replace("pmtiles://__ADIV_MAP_URI__", "https://tiles.example/map"))).toThrow("remote URL");
    expect(() => validateOfflineStyle(style.replace('"shortbread":{', '"extra":{"type":"raster"},"shortbread":{'))).toThrow("local PMTiles");
  });

  it("builds a bounded FTS query from user input", () => {
    expect(makeFtsQuery("  Davao City! ")).toBe('"Davao"* AND "City"*');
    expect(makeFtsQuery("--- !!!")).toBe("");
    expect(makeFtsQuery("one two three four five six seven eight nine").split(" AND ")).toHaveLength(8);
  });

  it("keeps the checked-in Shortbread style local-only", () => {
    const template = readFileSync("mobile/scripts/offline-data/style-template.json", "utf8");
    const checked = validateOfflineStyle(template);
    expect(Object.keys(checked.sources)).toEqual(["shortbread", "adivPois"]);
    expect(checked.sources.shortbread?.url).toBe("pmtiles://__ADIV_MAP_URI__");
  });
});
