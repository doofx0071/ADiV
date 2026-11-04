import { beforeEach, describe, expect, it, vi } from "vitest";

const { values } = vi.hoisted(() => ({ values: new Map<string, string>() }));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
  },
}));

import {
  clearMapActivityLog,
  getMapActivitySnapshot,
  MAPBOX_USAGE_STORAGE_KEY,
  recordMapActivity,
} from "../mobile/src/lib/mapbox-usage";

describe("local Mapbox activity log", () => {
  beforeEach(() => values.clear());

  it("records provider events as aggregate counters without storing coordinates", async () => {
    await Promise.all([
      recordMapActivity("mapboxMapStyleLoaded"),
      recordMapActivity("mapboxMapStyleLoaded"),
      recordMapActivity("mapLibreMapStyleLoaded"),
    ]);

    const snapshot = await getMapActivitySnapshot();
    expect(snapshot.metrics.mapboxMapStyleLoaded.count).toBe(2);
    expect(snapshot.metrics.mapLibreMapStyleLoaded.count).toBe(1);
    expect(values.get(MAPBOX_USAGE_STORAGE_KEY)).not.toContain("coordinates");
  });

  it("keeps route, guidance, and offline actions as separate local events", async () => {
    await recordMapActivity("routeRequestSucceeded");
    await recordMapActivity("guidanceStartSucceeded");
    await recordMapActivity("offlineRegionLoadRequested");

    const snapshot = await getMapActivitySnapshot();
    expect(snapshot.metrics.routeRequestSucceeded.count).toBe(1);
    expect(snapshot.metrics.guidanceStartSucceeded.count).toBe(1);
    expect(snapshot.metrics.offlineRegionLoadRequested.count).toBe(1);
  });

  it("clears only this device's counters and preserves an empty schema", async () => {
    await recordMapActivity("mapboxMapStyleLoaded");
    await clearMapActivityLog();

    const snapshot = await getMapActivitySnapshot();
    expect(snapshot.metrics.mapboxMapStyleLoaded.count).toBe(0);
    expect(snapshot.schemaVersion).toBe(1);
  });
});
