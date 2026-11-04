import { z } from "zod";

export function isSafePackPath(value: string): boolean {
  if (!value || value.length > 240 || value.includes("\\") || value.startsWith("/")) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

const packPath = z.string().refine(isSafePackPath, "Pack paths must be relative and cannot traverse directories.");
const sha256 = z.string().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest.");
const assetFile = z.object({
  path: packPath,
  sha256,
  bytes: z.number().int().positive().max(30 * 1024 ** 3),
});

const OfflinePackManifestSchema = z.object({
  format: z.literal("adiv-offline-pack"),
  manifestVersion: z.literal(1),
  packId: z.string().regex(/^ph-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
  name: z.string().min(1).max(100),
  region: z.enum(["davao", "mindanao", "philippines"]),
  dataDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minimumAppVersion: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
  attribution: z.string().min(1).max(500),
  source: z.object({
    provider: z.literal("Geofabrik"),
    pbfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    pbfMd5: z.string().regex(/^[a-f0-9]{32}$/i),
  }),
  licenses: z.array(z.object({
    component: z.string().min(1).max(120),
    license: z.string().min(1).max(80),
    attribution: z.string().max(300).optional(),
  })).min(1).max(30),
  coverage: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  mapSchema: z.literal("shortbread-1.1"),
  searchSchemaVersion: z.literal(2),
  assets: z.object({
    map: packPath,
    search: packPath,
    poi: packPath,
    style: packPath,
    glyphsDir: packPath,
    sprite: packPath,
    routing: z.object({
      path: packPath,
      engine: z.literal("valhalla"),
      engineVersion: z.string().min(1).max(40),
    }).optional(),
  }),
  files: z.array(assetFile).min(3).max(100_000),
});

export type OfflinePackManifest = z.infer<typeof OfflinePackManifestSchema>;

export interface InstalledOfflinePack {
  packId: string;
  version: string;
  name: string;
  region: OfflinePackManifest["region"];
  dataDate: string;
  coverage: OfflinePackManifest["coverage"];
  attribution: string;
  mapUri: string;
  styleUri: string;
  searchUri: string;
  routingAvailable: boolean;
  directoryUri: string;
  sizeBytes: number;
}

export interface PackVerificationResult {
  valid: boolean;
  pack?: InstalledOfflinePack;
  error?: string;
}

export interface OfflinePackFileCheck {
  path: string;
  expectedBytes: number;
  expectedSha256: string;
}

export function parseOfflinePackManifest(value: unknown): OfflinePackManifest {
  const parsed = OfflinePackManifestSchema.parse(value);
  const [west, south, east, north] = parsed.coverage;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) {
    throw new Error("Pack coverage bounds are invalid.");
  }
  const parsedDate = new Date(`${parsed.dataDate}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== parsed.dataDate) {
    throw new Error("Pack data date is invalid.");
  }

  const allPaths = new Set<string>();
  const directoryPaths = new Set<string>();
  if (parsed.files.some((file) => file.path === "manifest.json")) {
    throw new Error("The manifest cannot checksum itself.");
  }
  for (const file of parsed.files) {
    if (allPaths.has(file.path)) throw new Error(`Pack manifest repeats ${file.path}.`);
    if (directoryPaths.has(file.path)) throw new Error(`Pack path conflicts with a folder: ${file.path}.`);
    const segments = file.path.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      const parentPath = segments.slice(0, index).join("/");
      if (allPaths.has(parentPath)) throw new Error(`Pack path conflicts with a file: ${parentPath}.`);
      directoryPaths.add(parentPath);
    }
    allPaths.add(file.path);
  }
  for (const requiredPath of [parsed.assets.map, parsed.assets.search, parsed.assets.poi, parsed.assets.style]) {
    if (!allPaths.has(requiredPath)) throw new Error(`Pack manifest does not checksum ${requiredPath}.`);
  }
  if (parsed.assets.routing && !allPaths.has(parsed.assets.routing.path)) {
    throw new Error("Pack manifest does not checksum its routing graph.");
  }
  if (!/openstreetmap/i.test(parsed.attribution) || !/odbl(?:-1\.0)?/i.test(parsed.attribution)) {
    throw new Error("Pack attribution must credit OpenStreetMap and identify the ODbL-1.0 data license.");
  }
  if (!parsed.licenses.some((item) => /openstreetmap/i.test(item.component) && /odbl/i.test(item.license))) {
    throw new Error("Pack manifest must list the OpenStreetMap ODbL-1.0 license.");
  }
  if (!parsed.files.some((file) => file.path.startsWith(`${parsed.assets.glyphsDir}/`))) {
    throw new Error("Pack manifest has no glyph files.");
  }
  for (const extension of [".json", ".png"]) {
    if (!allPaths.has(`${parsed.assets.sprite}${extension}`)) {
      throw new Error(`Pack manifest has no ${extension.slice(1)} sprite file.`);
    }
  }
  return parsed;
}

export function assertMinimumAppVersion(minimum: string, current: string): void {
  const toParts = (value: string) => value.split(".").map(Number);
  const minParts = toParts(minimum);
  const appParts = toParts(current);
  for (let index = 0; index < 3; index += 1) {
    const difference = (appParts[index] ?? 0) - (minParts[index] ?? 0);
    if (difference > 0) return;
    if (difference < 0) throw new Error(`This pack needs ADiV ${minimum} or newer.`);
  }
}

export interface OfflineStyleSummary {
  version: number;
  sources: Record<string, { type?: string; url?: string; data?: string; tiles?: string[] }>;
  glyphs?: string;
  sprite?: string | string[];
}

export function validateOfflineStyle(styleText: string): OfflineStyleSummary {
  if (styleText.length > 5 * 1024 * 1024) throw new Error("The offline map style is unexpectedly large.");
  let style: unknown;
  try {
    style = JSON.parse(styleText) as unknown;
  } catch {
    throw new Error("The offline map style is not valid JSON.");
  }
  if (!style || typeof style !== "object") throw new Error("The offline map style is invalid.");
  const record = style as Record<string, unknown>;
  if (record.version !== 8 || !record.sources || typeof record.sources !== "object" || Array.isArray(record.sources)) {
    throw new Error("The offline map style must use the MapLibre style specification with vector sources.");
  }
  const sources = record.sources as Record<string, { type?: string; url?: string; data?: string; tiles?: string[] }>;
  const urls: string[] = [];
  const collectUrls = (value: unknown) => {
    if (typeof value === "string") {
      if (/^(?:https?:)?\/\//i.test(value)) throw new Error("Offline style contains a remote URL.");
      if (/^(?:pmtiles|file|asset):\/\//i.test(value) && !value.includes("__ADIV_")) {
        throw new Error("Offline style file references must use pack placeholders.");
      }
      if (value.startsWith("pmtiles://")) urls.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collectUrls);
      return;
    }
    if (value && typeof value === "object") Object.values(value).forEach(collectUrls);
  };
  collectUrls(record);

  const sourceEntries = Object.entries(sources);
  const mapSource = sourceEntries.find(([, source]) => source.type === "vector");
  const poiSource = sourceEntries.find(([, source]) => source.type === "geojson");
  if (
    sourceEntries.length !== 2 ||
    mapSource?.[1]?.url !== "pmtiles://__ADIV_MAP_URI__" ||
    poiSource?.[1]?.data !== "__ADIV_POI_URI__" ||
    urls.some((url) => url !== "pmtiles://__ADIV_MAP_URI__")
  ) {
    throw new Error("Offline style must use the pack's local PMTiles map and indexed POI sources only.");
  }
  if (Object.values(sources).some((source) => source?.tiles?.length)) {
    throw new Error("Offline style must use a PMTiles source, not tile URLs.");
  }
  if (record.glyphs !== "__ADIV_GLYPHS_URI__/{fontstack}/{range}.pbf") {
    throw new Error("Offline style glyphs must refer to the pack's local glyph directory.");
  }
  if (record.sprite !== "__ADIV_SPRITE_URI__") {
    throw new Error("Offline style sprites must refer to the pack's local sprite files.");
  }
  const sourceIds = new Set(sourceEntries.map(([sourceId]) => sourceId));
  if (!Array.isArray(record.layers)) throw new Error("Offline map style has no layers.");
  const layerIds = new Set<string>();
  for (const layer of record.layers) {
    if (!layer || typeof layer !== "object") throw new Error("Offline map style contains an invalid layer.");
    const layerId = (layer as Record<string, unknown>).id;
    if (typeof layerId === "string") layerIds.add(layerId);
    const layerSource = (layer as Record<string, unknown>).source;
    if (typeof layerSource === "string" && !sourceIds.has(layerSource)) {
      throw new Error("Offline map style contains a layer that is not backed by the local map source.");
    }
  }
  if (!layerIds.has("street-labels") || !layerIds.has("search-poi-labels")) {
    throw new Error("Offline style must render street names and indexed place/business labels.");
  }
  return record as unknown as OfflineStyleSummary;
}

export function resolveOfflineStyle(
  styleText: string,
  packDirectoryUri: string,
  manifest: OfflinePackManifest,
): string {
  validateOfflineStyle(styleText);
  const root = `${packDirectoryUri.replace(/\/$/, "")}/`;
  const replacements: Record<string, string> = {
    __ADIV_MAP_URI__: `${root}${manifest.assets.map}`,
    __ADIV_POI_URI__: `${root}${manifest.assets.poi}`,
    __ADIV_GLYPHS_URI__: manifest.assets.glyphsDir ? `${root}${manifest.assets.glyphsDir}` : "",
    __ADIV_SPRITE_URI__: manifest.assets.sprite ? `${root}${manifest.assets.sprite}` : "",
  };
  return styleText.replace(/__ADIV_(?:MAP|POI|GLYPHS|SPRITE)_URI__/g, (placeholder) => replacements[placeholder] ?? "");
}

export function makeFtsQuery(query: string): string {
  const normalized = query.normalize("NFKC").trim().replace(/[^\p{L}\p{N}\s'-]/gu, " ");
  const terms = normalized.split(/\s+/).filter((term) => /[\p{L}\p{N}]/u.test(term)).slice(0, 8);
  return terms.map((term) => `"${term.replace(/"/g, '""')}"*`).join(" AND ");
}
