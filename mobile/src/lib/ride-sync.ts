import { api } from "./api";
import { convexClient } from "./convex";
import { acknowledgeRideUpload, deferRideUpload, getDueRideOutbox } from "./local-ride-store";

let syncInProgress = false;

/** Replay compact ride summaries only; local GPS samples are never sent to Convex. */
export async function flushRideOutbox(): Promise<number> {
  if (!convexClient || syncInProgress) return 0;
  syncInProgress = true;
  let acknowledged = 0;
  try {
    const entries = await getDueRideOutbox();
    for (const entry of entries) {
      try {
        const serverRideId = await convexClient.mutation(api.rides.logRide, entry.payload);
        await acknowledgeRideUpload(entry.clientRideId, serverRideId);
        acknowledged += 1;
      } catch {
        const attemptCount = entry.attemptCount + 1;
        const backoffMs = Math.min(30_000 * 2 ** Math.min(attemptCount - 1, 10), 6 * 60 * 60 * 1000);
        const jitter = 0.8 + Math.random() * 0.4;
        await deferRideUpload(entry.clientRideId, attemptCount, Date.now() + backoffMs * jitter);
      }
    }
    return acknowledged;
  } finally {
    syncInProgress = false;
  }
}
