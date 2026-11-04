import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * App-observed Mapbox activity only. This deliberately stores aggregate event
 * counts and timestamps, never tokens, coordinates, route shapes, or searches.
 * These values are not Mapbox's billable usage statistics.
 */
export const MAPBOX_USAGE_STORAGE_KEY = "adiv.mobile.mapbox-usage.v1";

export type MapActivityEvent =
  | "mapboxMapStyleLoaded"
  | "mapLibreMapStyleLoaded"
  | "routeRequestSucceeded"
  | "guidanceStartSucceeded"
  | "guidanceStopRequested"
  | "offlineRegionLoadRequested";

export interface MapActivityMetric {
  count: number;
  firstAt: number | null;
  lastAt: number | null;
}

export type MapActivityMetrics = Record<MapActivityEvent, MapActivityMetric>;

export interface MapActivitySnapshot {
  schemaVersion: 1;
  resetAt: number;
  metrics: MapActivityMetrics;
}

const EVENT_NAMES: MapActivityEvent[] = [
  "mapboxMapStyleLoaded",
  "mapLibreMapStyleLoaded",
  "routeRequestSucceeded",
  "guidanceStartSucceeded",
  "guidanceStopRequested",
  "offlineRegionLoadRequested",
];

let writeQueue: Promise<void> = Promise.resolve();

function emptyMetric(): MapActivityMetric {
  return { count: 0, firstAt: null, lastAt: null };
}

function emptySnapshot(resetAt = Date.now()): MapActivitySnapshot {
  return {
    schemaVersion: 1,
    resetAt,
    metrics: Object.fromEntries(EVENT_NAMES.map((name) => [name, emptyMetric()])) as MapActivityMetrics,
  };
}

function parseSnapshot(raw: string | null): MapActivitySnapshot {
  if (!raw) return emptySnapshot();

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return emptySnapshot();
    const stored = value as Partial<MapActivitySnapshot>;
    if (stored.schemaVersion !== 1 || typeof stored.resetAt !== "number" || !stored.metrics) return emptySnapshot();

    const metrics = emptySnapshot(stored.resetAt).metrics;
    for (const name of EVENT_NAMES) {
      const metric = stored.metrics[name];
      if (!metric || typeof metric.count !== "number" || metric.count < 0) continue;
      metrics[name] = {
        count: Math.floor(metric.count),
        firstAt: typeof metric.firstAt === "number" ? metric.firstAt : null,
        lastAt: typeof metric.lastAt === "number" ? metric.lastAt : null,
      };
    }
    return { schemaVersion: 1, resetAt: stored.resetAt, metrics };
  } catch {
    return emptySnapshot();
  }
}

async function readSnapshot(): Promise<MapActivitySnapshot> {
  try {
    return parseSnapshot(await AsyncStorage.getItem(MAPBOX_USAGE_STORAGE_KEY));
  } catch {
    return emptySnapshot();
  }
}

export async function getMapActivitySnapshot(): Promise<MapActivitySnapshot> {
  await writeQueue;
  return readSnapshot();
}

export function recordMapActivity(event: MapActivityEvent): Promise<void> {
  const next = writeQueue.then(async () => {
    const snapshot = await readSnapshot();
    const now = Date.now();
    const previous = snapshot.metrics[event];
    snapshot.metrics[event] = {
      count: previous.count + 1,
      firstAt: previous.firstAt ?? now,
      lastAt: now,
    };
    try {
      await AsyncStorage.setItem(MAPBOX_USAGE_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Activity logging is optional and must never disrupt mapping or riding.
    }
  });
  writeQueue = next.catch(() => undefined);
  return writeQueue;
}

export function clearMapActivityLog(): Promise<void> {
  const next = writeQueue.then(async () => {
    try {
      await AsyncStorage.setItem(MAPBOX_USAGE_STORAGE_KEY, JSON.stringify(emptySnapshot()));
    } catch {
      // Clearing diagnostics is best-effort; the app remains usable if storage fails.
    }
  });
  writeQueue = next.catch(() => undefined);
  return writeQueue;
}
