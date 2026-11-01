import { describe, expect, it } from "vitest";
import {
  decodePolyline,
  encodePolyline,
  haversineMeters,
  shouldAcceptPoint,
  trackDistanceKm,
  type TrackPoint,
} from "../../lib/geo";

const point = (overrides: Partial<TrackPoint>): TrackPoint => ({
  lat: 14.5995,
  lon: 120.9842,
  ts: 0,
  ...overrides,
});

describe("shouldAcceptPoint", () => {
  it("rejects fixes worse than the accuracy gate", () => {
    expect(shouldAcceptPoint(null, point({ accuracy: 80 }))).toBe(false);
    expect(shouldAcceptPoint(null, point({ accuracy: 10 }))).toBe(true);
    expect(shouldAcceptPoint(null, point({}))).toBe(true); // no accuracy info → keep
  });

  it("rejects duplicate or out-of-order timestamps", () => {
    const prev = point({ ts: 1000 });
    expect(shouldAcceptPoint(prev, point({ ts: 1000 }))).toBe(false);
    expect(shouldAcceptPoint(prev, point({ ts: 500 }))).toBe(false);
    expect(shouldAcceptPoint(prev, point({ ts: 2000 }))).toBe(true);
  });

  it("rejects physically impossible jumps (> 180 km/h)", () => {
    const prev = point({ lat: 14.5995, lon: 120.9842, ts: 0 });
    // ~1.1 km in 1 second — impossible
    const jump = point({ lat: 14.6095, lon: 120.9842, ts: 1000 });
    expect(shouldAcceptPoint(prev, jump)).toBe(false);
    // ~11 m in 1 second — plausible
    const plausible = point({ lat: 14.5996, lon: 120.9842, ts: 1000 });
    expect(shouldAcceptPoint(prev, plausible)).toBe(true);
  });
});

describe("haversineMeters", () => {
  it("measures known distances closely", () => {
    // Manila → Quezon City circle, roughly 10-12 km apart
    const meters = haversineMeters(
      { lat: 14.5995, lon: 120.9842 },
      { lat: 14.6760, lon: 121.0437 },
    );
    expect(meters).toBeGreaterThan(8000);
    expect(meters).toBeLessThan(12000);
    // Same point → zero
    expect(haversineMeters({ lat: 14, lon: 120 }, { lat: 14, lon: 120 })).toBe(0);
  });
});

describe("trackDistanceKm", () => {
  it("sums consecutive same-run pairs and skips pause gaps", () => {
    const points: TrackPoint[] = [
      { lat: 14.5995, lon: 120.9842, ts: 0, runId: 1 },
      { lat: 14.6005, lon: 120.9842, ts: 1000, runId: 1 }, // ~111 m
      { lat: 14.6015, lon: 120.9842, ts: 2000, runId: 1 }, // ~111 m
      { lat: 14.7000, lon: 120.9842, ts: 3000, runId: 2 }, // pause gap — skipped
      { lat: 14.7001, lon: 120.9842, ts: 4000, runId: 2 }, // ~11 m
    ];
    const km = trackDistanceKm(points);
    expect(km).toBeGreaterThan(0.22);
    expect(km).toBeLessThan(0.25);
  });
});

describe("polyline codec", () => {
  it("round-trips coordinates through encode/decode", () => {
    const coordinates: [number, number][] = [
      [120.9842, 14.5995],
      [120.9852, 14.6005],
      [120.9861, 14.6015],
      [120.9870, 14.6024],
    ];
    const encoded = encodePolyline(coordinates);
    const decoded = decodePolyline(encoded);
    expect(decoded).toHaveLength(coordinates.length);
    for (let i = 0; i < coordinates.length; i++) {
      expect(decoded[i][0]).toBeCloseTo(coordinates[i][0], 4);
      expect(decoded[i][1]).toBeCloseTo(coordinates[i][1], 4);
    }
  });

  it("matches the documented Google example string", () => {
    // Google's polyline docs example: (38.5, -120.2) → (40.7, -120.95)
    expect(encodePolyline([[-120.2, 38.5], [-120.95, 40.7]])).toBe("_p~iF~ps|U_ulLnnqC");
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC")).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
    ]);
  });

  it("handles empty input", () => {
    expect(encodePolyline([])).toBe("");
    expect(decodePolyline("")).toEqual([]);
  });
});
