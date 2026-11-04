import { describe, expect, it } from "vitest";
import { buildGpx } from "../mobile/src/lib/gpx";

describe("local ride GPX export", () => {
  it("keeps pause/resume breaks as separate track segments and escapes the ride name", () => {
    const gpx = buildGpx("Davao & Samal <test>", [
      { lat: 7, lon: 125, ts: 1_700_000_000_000, runId: 1 },
      { lat: 7.001, lon: 125.001, ts: 1_700_000_010_000, runId: 1 },
      { lat: 7.01, lon: 125.01, ts: 1_700_000_100_000, runId: 2 },
    ]);

    expect(gpx).toContain("Davao &amp; Samal &lt;test&gt;");
    expect(gpx).toContain('<trkpt lat="7.0000000" lon="125.0000000">');
    expect(gpx.match(/<trkseg>/g)).toHaveLength(2);
    expect(gpx.match(/<trkpt /g)).toHaveLength(3);
  });

  it("rejects an empty local track", () => {
    expect(() => buildGpx("ride", [])).toThrow("no valid GPS points");
  });
});
