import { buildRideSummaryPayload, restoredRecorderPhase } from "../mobile/src/lib/ride-model";
import { describe, expect, it } from "vitest";

describe("offline ride summary contract", () => {
  it("recovers interrupted sessions without claiming they finished", () => {
    expect(restoredRecorderPhase("recording", true)).toBe("recovered");
    expect(restoredRecorderPhase("paused", false)).toBe("paused");
    expect(restoredRecorderPhase("completed", false)).toBe("summary");
  });

  it("creates a summary upload without GPS geometry", () => {
    const payload = buildRideSummaryPayload({
      clientRideId: "ride-local-1",
      startOdometer: 1200,
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_000_180_000,
      notes: "  test ride  ",
      points: [
        { lat: 7.0, lon: 125.0, ts: 1_700_000_000_000, runId: 1, speed: 5 },
        { lat: 7.001, lon: 125.0, ts: 1_700_000_180_000, runId: 1, speed: 10 },
      ],
      elapsedMs: 60_000,
    });

    expect(payload.clientRideId).toBe("ride-local-1");
    expect(payload.endOdometer).toBeGreaterThan(payload.startOdometer);
    expect(payload.notes).toBe("test ride");
    expect(payload).not.toHaveProperty("route");
    expect(payload).not.toHaveProperty("points");
    expect(payload.durationMinutes).toBe(1);
  });
});
