import type { TrackPoint } from "../../../lib/geo";

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&apos;";
      default: return character;
    }
  });
}

function splitRuns(points: TrackPoint[]): TrackPoint[][] {
  const runs: TrackPoint[][] = [];
  for (const point of points) {
    if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) continue;
    if (!Number.isFinite(point.lon) || point.lon < -180 || point.lon > 180) continue;
    if (!Number.isFinite(point.ts) || !Number.isFinite(new Date(point.ts).getTime())) continue;
    const runId = point.runId ?? 1;
    const lastRun = runs[runs.length - 1];
    const lastRunId = lastRun?.[0]?.runId ?? 1;
    if (!lastRun || lastRunId !== runId) runs.push([point]);
    else lastRun.push(point);
  }
  return runs.filter((run) => run.length > 0);
}

export function buildGpx(name: string, points: TrackPoint[]): string {
  const runs = splitRuns(points);
  if (runs.length === 0) throw new Error("This ride has no valid GPS points to export.");
  const trackName = xmlEscape(name.trim() || "ADiV GPS ride");
  const segments = runs.map((run) => {
    const trackPoints = run.map((point) =>
      `      <trkpt lat="${point.lat.toFixed(7)}" lon="${point.lon.toFixed(7)}"><time>${new Date(point.ts).toISOString()}</time></trkpt>`,
    ).join("\n");
    return `    <trkseg>\n${trackPoints}\n    </trkseg>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="ADiV" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <trk>\n    <name>${trackName}</name>\n${segments.join("\n")}\n  </trk>`,
    "</gpx>",
    "",
  ].join("\n");
}
