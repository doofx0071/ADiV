import { describe, expect, it } from "vitest";
import { ACTIVITY_SHARE_SIZE, buildActivityShareData, maskTrackEndpoints, projectTrackSegments } from "../mobile/src/lib/activity-share";
import { RIDE_MODES, type LocalRideRecord } from "../mobile/src/lib/ride-model";
import type { TrackPoint } from "../lib/geo";

function makeRide(points: TrackPoint[], elapsedMs = 30_000): LocalRideRecord {
  return {
    id: "ride-share-test",
    summary: {
      clientRideId: "ride-share-test",
      startOdometer: 100,
      endOdometer: 100.1,
      date: 1_700_000_000_000,
      durationMinutes: Math.max(1, Math.round(elapsedMs / 60_000)),
      startAt: 1_700_000_000_000,
      endAt: 1_700_000_000_000 + elapsedMs,
      source: "gps",
      trackedDistance: 0.1,
      maxSpeedKmh: 25,
    },
    points,
    elapsedMs,
    syncState: "local_only",
    serverRideId: null,
  };
}

describe("activity share geometry and metrics", () => {
  it("defines only the two target riding modes and required PNG dimensions", () => {
    expect(RIDE_MODES).toEqual(["recordOnly", "navigateAndRecord"]);
    expect(ACTIVITY_SHARE_SIZE.story).toEqual({ width: 1080, height: 1920 });
    expect(ACTIVITY_SHARE_SIZE.square).toEqual({ width: 1080, height: 1080 });
  });

  it("keeps actual points split across pause/resume runs and derives observed moving/stopped time", () => {
    const points: TrackPoint[] = [
      { lat: 7, lon: 125, ts: 1_000, speed: 2, runId: 1 },
      { lat: 7.001, lon: 125, ts: 11_000, speed: 2, runId: 1 },
      { lat: 7.01, lon: 125, ts: 31_000, speed: 0.2, runId: 2 },
      { lat: 7.0101, lon: 125, ts: 41_000, speed: 0.2, runId: 2 },
    ];

    const result = buildActivityShareData(makeRide(points), 0);

    expect(result.routeAvailable).toBe(true);
    expect(result.routeSegments).toHaveLength(2);
    expect(result.routeSegments.map((run) => run.length)).toEqual([2, 2]);
    expect(result.stats.movingMs).toBe(10_000);
    expect(result.stats.stoppedMs).toBe(10_000);
    expect(result.stats.elapsedMs).toBe(30_000);
    expect(result.stats.averageSpeedKmh).toBe(36);
  });

  it("masks only the exported endpoints by distance and leaves stored ride points untouched", () => {
    const points: TrackPoint[] = [
      { lat: 0, lon: 0, ts: 1_000, runId: 1 },
      { lat: 0, lon: 0.002, ts: 11_000, runId: 1 },
      { lat: 0, lon: 0.004, ts: 21_000, runId: 1 },
    ];
    const original = structuredClone(points);
    const masked = maskTrackEndpoints([points], 50, 50);

    expect(masked).toHaveLength(1);
    expect(masked[0]).toHaveLength(3);
    expect(masked[0][0].lon).toBeGreaterThan(points[0].lon);
    expect(masked[0].at(-1)?.lon).toBeLessThan(points.at(-1)!.lon);
    expect(points).toEqual(original);
  });

  it("does not advertise a route for zero or one valid point", () => {
    const onlyPoint = { lat: 7, lon: 125, ts: 1_000, runId: 1 };
    expect(buildActivityShareData(makeRide([])).routeAvailable).toBe(false);
    expect(buildActivityShareData(makeRide([onlyPoint])).routeAvailable).toBe(false);
  });

  it("leaves speed duration unavailable when the saved points have no reliable speed samples", () => {
    const result = buildActivityShareData(makeRide([
      { lat: 7, lon: 125, ts: 1_000, runId: 1 },
      { lat: 7.001, lon: 125, ts: 11_000, runId: 1 },
    ]));

    expect(result.stats.movingMs).toBeNull();
    expect(result.stats.stoppedMs).toBeNull();
    expect(result.stats.averageSpeedKmh).toBeNull();
  });

  it("fits a route into Story and Square viewports without stretching its aspect ratio", () => {
    const points: TrackPoint[] = [
      { lat: 0, lon: 0, ts: 1_000, runId: 1 },
      { lat: 1, lon: 2, ts: 2_000, runId: 1 },
    ];
    const story = projectTrackSegments([points], 1080, 1920, 0);
    const square = projectTrackSegments([points], 1080, 1080, 0);
    const bounds = (projected: [number, number][]) => ({
      width: Math.max(...projected.map(([x]) => x)) - Math.min(...projected.map(([x]) => x)),
      height: Math.max(...projected.map(([, y]) => y)) - Math.min(...projected.map(([, y]) => y)),
    });
    const storyBounds = bounds(story[0]);
    const squareBounds = bounds(square[0]);

    expect(storyBounds.width / storyBounds.height).toBeCloseTo(squareBounds.width / squareBounds.height, 8);
    expect(Math.max(storyBounds.width, storyBounds.height)).toBeCloseTo(1080, 5);
    expect(Math.max(squareBounds.width, squareBounds.height)).toBeCloseTo(1080, 5);
  });

  it("aligns the rendered geometry to the selected vertical position", () => {
    const points: TrackPoint[] = [
      { lat: 0, lon: 0, ts: 1_000, runId: 1 },
      { lat: 1, lon: 0, ts: 2_000, runId: 1 },
    ];
    const top = projectTrackSegments([points], 200, 400, 20, "top")[0];
    const bottom = projectTrackSegments([points], 200, 400, 20, "bottom")[0];

    expect(Math.min(...top.map(([, y]) => y))).toBe(20);
    expect(Math.max(...bottom.map(([, y]) => y))).toBe(380);
  });
});
