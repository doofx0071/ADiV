import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { buildGpx } from "./gpx";
import { getSavedLocalRide } from "./local-ride-store";
import type { LocalRideRecord } from "./ride-model";

function safeFilename(value: string): string {
  return value.normalize("NFKD").replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 48) || "ride";
}

export async function shareLocalRideAsGpx(ride: LocalRideRecord): Promise<void> {
  const withPoints = ride.points.length > 0 ? ride : await getSavedLocalRide(ride.id);
  if (!withPoints) throw new Error("This local GPS track is no longer available on this device.");
  const name = ride.summary.notes?.trim() || "ADiV GPS ride";
  const content = buildGpx(name, withPoints.points);
  const day = new Date(ride.summary.date).toISOString().slice(0, 10);
  const filename = `adiv-${safeFilename(name)}-${day}-${safeFilename(ride.id)}.gpx`;
  const file = new File(Paths.cache, filename);
  file.create({ intermediates: true, overwrite: true });
  await file.write(content);
  if (!await Sharing.isAvailableAsync()) throw new Error("File sharing is not available on this device.");
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/gpx+xml",
    dialogTitle: "Share ADiV GPS track",
  });
}
