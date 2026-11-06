import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import type { TrackPoint } from "../../../lib/geo";
import type {
  ActiveRideState,
  LocalRideRecord,
  PersistedRideStatus,
  RideOutboxEntry,
  RideMode,
  RideSummaryPayload,
  RideSyncState,
} from "./ride-model";
import { createDemoRideFixtures, demoModeForRideId, type DemoRideFixture } from "./demo-ride-fixtures";

const DATABASE_NAME = "adiv-local.db";
const LEGACY_ACTIVE_RIDE_KEY = "adiv-active-ride";
const ACTIVE_RIDE_KEY = "active_ride_id";
const ACTIVE_RIDE_MODE_KEY = "adiv-active-ride-mode";

interface RideRow {
  id: string;
  started_at_ms: number;
  ended_at_ms: number | null;
  status: PersistedRideStatus;
  run_id: number;
  run_started_at_ms: number | null;
  elapsed_ms: number;
  interrupted: number;
  summary_json: string | null;
  sync_state: RideSyncState;
  server_ride_id: string | null;
}

interface OutboxRow {
  operation_id: string;
  client_ride_id: string;
  payload_json: string;
  attempt_count: number;
  next_attempt_at_ms: number | null;
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function newRideId(): string {
  return `ride-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function activeElapsedFromPoints(points: TrackPoint[]): number {
  const runs = new Map<number, { first: number; last: number }>();
  for (const point of points) {
    const runId = point.runId ?? 1;
    const run = runs.get(runId);
    if (!run) runs.set(runId, { first: point.ts, last: point.ts });
    else {
      run.first = Math.min(run.first, point.ts);
      run.last = Math.max(run.last, point.ts);
    }
  }
  return [...runs.values()].reduce((sum, run) => sum + Math.max(0, run.last - run.first), 0);
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
      const version = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
      if ((version?.user_version ?? 0) < 1) {
        await db.execAsync(`
          CREATE TABLE rides (
            id TEXT PRIMARY KEY NOT NULL,
            started_at_ms INTEGER NOT NULL,
            ended_at_ms INTEGER,
            status TEXT NOT NULL CHECK(status IN ('recording', 'paused', 'completed', 'saved')),
            run_id INTEGER NOT NULL DEFAULT 1,
            run_started_at_ms INTEGER,
            elapsed_ms INTEGER NOT NULL DEFAULT 0,
            interrupted INTEGER NOT NULL DEFAULT 0,
            summary_json TEXT,
            sync_state TEXT NOT NULL DEFAULT 'local_only' CHECK(sync_state IN ('local_only', 'pending_sync', 'synced')),
            server_ride_id TEXT,
            modified_at_ms INTEGER NOT NULL
          );
          CREATE TABLE ride_points (
            ride_id TEXT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
            seq INTEGER NOT NULL,
            timestamp_ms INTEGER NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            accuracy_m REAL,
            speed_mps REAL,
            run_id INTEGER NOT NULL,
            PRIMARY KEY (ride_id, seq)
          );
          CREATE INDEX ride_points_by_time ON ride_points (ride_id, timestamp_ms);
          CREATE TABLE ride_sync_outbox (
            operation_id TEXT PRIMARY KEY NOT NULL,
            client_ride_id TEXT NOT NULL UNIQUE,
            payload_json TEXT NOT NULL,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            next_attempt_at_ms INTEGER,
            created_at_ms INTEGER NOT NULL
          );
          CREATE TABLE local_state (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
          );
          PRAGMA user_version = 1;
        `);
      }
      await migrateLegacyActiveRide(db);
      return db;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function migrateLegacyActiveRide(db: SQLite.SQLiteDatabase): Promise<void> {
  const raw = await AsyncStorage.getItem(LEGACY_ACTIVE_RIDE_KEY);
  if (!raw) return;

  let oldState: { points?: TrackPoint[]; startedAt?: number | null; runId?: number };
  try {
    oldState = JSON.parse(raw) as typeof oldState;
  } catch {
    return;
  }
  const points = (oldState.points ?? []).filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lon) && Number.isFinite(point.ts),
  );
  if (points.length === 0) {
    await AsyncStorage.removeItem(LEGACY_ACTIVE_RIDE_KEY);
    return;
  }

  const existing = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM local_state WHERE key = ?",
    ACTIVE_RIDE_KEY,
  );
  if (!existing) {
    const id = newRideId();
    const now = Date.now();
    const startedAt = points[0]?.ts ?? oldState.startedAt ?? now;
    const runId = Math.max(1, oldState.runId ?? 1);
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO rides (id, started_at_ms, status, run_id, elapsed_ms, interrupted, modified_at_ms)
         VALUES (?, ?, 'paused', ?, ?, 1, ?)`,
        id,
        startedAt,
        runId,
        activeElapsedFromPoints(points),
        now,
      );
      for (let seq = 0; seq < points.length; seq += 1) {
        const point = points[seq];
        await tx.runAsync(
          `INSERT INTO ride_points (ride_id, seq, timestamp_ms, lat, lon, accuracy_m, speed_mps, run_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          seq,
          point.ts,
          point.lat,
          point.lon,
          point.accuracy ?? null,
          point.speed ?? null,
          point.runId ?? 1,
        );
      }
      await tx.runAsync("INSERT INTO local_state (key, value) VALUES (?, ?)", ACTIVE_RIDE_KEY, id);
    });
  }
  await AsyncStorage.removeItem(LEGACY_ACTIVE_RIDE_KEY);
}

async function pointsForRide(db: SQLite.SQLiteDatabase, rideId: string): Promise<TrackPoint[]> {
  const rows = await db.getAllAsync<{
    timestamp_ms: number;
    lat: number;
    lon: number;
    accuracy_m: number | null;
    speed_mps: number | null;
    run_id: number;
  }>(
    `SELECT timestamp_ms, lat, lon, accuracy_m, speed_mps, run_id
     FROM ride_points WHERE ride_id = ? ORDER BY seq LIMIT 50000`,
    rideId,
  );
  return rows.map((row) => ({
    ts: row.timestamp_ms,
    lat: row.lat,
    lon: row.lon,
    accuracy: row.accuracy_m ?? undefined,
    speed: row.speed_mps ?? undefined,
    runId: row.run_id,
  }));
}

function mapActiveRide(row: RideRow, points: TrackPoint[]): ActiveRideState {
  return {
    id: row.id,
    points,
    startedAt: row.started_at_ms,
    endedAt: row.ended_at_ms,
    runId: row.run_id,
    runStartedAt: row.run_started_at_ms,
    elapsedMs: row.elapsed_ms,
    status: row.status === "saved" ? "completed" : row.status,
    interrupted: row.interrupted === 1,
  };
}

export async function loadActiveRide(): Promise<ActiveRideState | null> {
  const db = await getDatabase();
  const state = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM local_state WHERE key = ?",
    ACTIVE_RIDE_KEY,
  );
  if (!state) return null;
  const row = await db.getFirstAsync<RideRow>("SELECT * FROM rides WHERE id = ?", state.value);
  if (!row) return null;
  const points = await pointsForRide(db, row.id);
  return mapActiveRide(row, points);
}

/** Close a missing native run using its start time, not the spacing of GPS fixes. */
export async function recoverInterruptedActiveRide(): Promise<ActiveRideState | null> {
  const db = await getDatabase();
  let recoveredId: string | null = null;
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const active = await tx.getFirstAsync<{ value: string }>(
      "SELECT value FROM local_state WHERE key = ?",
      ACTIVE_RIDE_KEY,
    );
    if (!active) return;
    const row = await tx.getFirstAsync<RideRow>("SELECT * FROM rides WHERE id = ?", active.value);
    if (!row || row.status !== "recording") return;
    // Screen-off can suspend GPS delivery without ending the ride. GPS point
    // spacing is not a clock: a run with sparse fixes can span minutes while
    // containing only one accepted point. Preserve the full active interval.
    const elapsedMs = row.elapsed_ms + (row.run_started_at_ms
      ? Math.max(0, now - row.run_started_at_ms)
      : 0);
    await tx.runAsync(
      "UPDATE rides SET status = 'paused', run_started_at_ms = NULL, elapsed_ms = ?, interrupted = 1, modified_at_ms = ? WHERE id = ?",
      elapsedMs,
      now,
      row.id,
    );
    recoveredId = row.id;
  });
  return recoveredId ? loadActiveRideForId(db, recoveredId) : null;
}

export async function startOrResumeRide(): Promise<ActiveRideState> {
  const db = await getDatabase();
  const active = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM local_state WHERE key = ?",
    ACTIVE_RIDE_KEY,
  );
  const now = Date.now();
  let id = active?.value;
  const row = id ? await db.getFirstAsync<RideRow>("SELECT * FROM rides WHERE id = ?", id) : null;

  if (row && row.status === "completed") throw new Error("End or save the current ride before starting another.");
  // Starting is idempotent for an already-active ride. In particular, do not
  // overwrite run_started_at_ms: that would reset the visible ride clock.
  if (row && row.status === "recording") {
    return (await loadActiveRideForId(db, row.id))!;
  }
  if (!row) {
    id = newRideId();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO rides (id, started_at_ms, status, run_id, run_started_at_ms, modified_at_ms)
         VALUES (?, ?, 'recording', 1, ?, ?)`,
        id!,
        now,
        now,
        now,
      );
      await tx.runAsync(
        `INSERT INTO local_state (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ACTIVE_RIDE_KEY,
        id!,
      );
    });
  } else {
    const hasPoints = await db.getFirstAsync<{ present: number }>(
      "SELECT 1 AS present FROM ride_points WHERE ride_id = ? LIMIT 1",
      row.id,
    );
    const runId = row.status === "paused" && hasPoints ? row.run_id + 1 : row.run_id;
    await db.runAsync(
      "UPDATE rides SET status = 'recording', run_id = ?, run_started_at_ms = ?, interrupted = 0, modified_at_ms = ? WHERE id = ?",
      runId,
      now,
      now,
      row.id,
    );
  }
  return (await loadActiveRideForId(db, id!))!;
}

/** Roll to a new GPS segment after a lost task while keeping the ride recording. */
export async function continueRecordingAfterTrackingGap(): Promise<ActiveRideState | null> {
  const db = await getDatabase();
  let continuedId: string | null = null;
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const active = await tx.getFirstAsync<{ value: string }>(
      "SELECT value FROM local_state WHERE key = ?",
      ACTIVE_RIDE_KEY,
    );
    if (!active) return;
    const row = await tx.getFirstAsync<RideRow>("SELECT * FROM rides WHERE id = ?", active.value);
    if (!row || row.status !== "recording") return;
    const elapsedMs = row.elapsed_ms + (row.run_started_at_ms
      ? Math.max(0, now - row.run_started_at_ms)
      : 0);
    const currentRunHasPoints = await tx.getFirstAsync<{ present: number }>(
      "SELECT 1 AS present FROM ride_points WHERE ride_id = ? AND run_id = ? LIMIT 1",
      row.id,
      row.run_id,
    );
    const runId = currentRunHasPoints ? row.run_id + 1 : row.run_id;
    await tx.runAsync(
      `UPDATE rides SET status = 'recording', run_id = ?, run_started_at_ms = ?,
       elapsed_ms = ?, interrupted = 1, modified_at_ms = ? WHERE id = ?`,
      runId,
      now,
      elapsedMs,
      now,
      row.id,
    );
    continuedId = row.id;
  });
  return continuedId ? loadActiveRideForId(db, continuedId) : null;
}

async function loadActiveRideForId(db: SQLite.SQLiteDatabase, id: string): Promise<ActiveRideState | null> {
  const row = await db.getFirstAsync<RideRow>("SELECT * FROM rides WHERE id = ?", id);
  return row ? mapActiveRide(row, await pointsForRide(db, id)) : null;
}

export async function appendRidePoints(rideId: string, points: TrackPoint[]): Promise<void> {
  if (points.length === 0) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const active = await tx.getFirstAsync<{ value: string }>(
      "SELECT value FROM local_state WHERE key = ?",
      ACTIVE_RIDE_KEY,
    );
    if (active?.value !== rideId) throw new Error("Active ride changed before GPS points were saved.");
    const ride = await tx.getFirstAsync<{ status: string; run_id: number }>("SELECT status, run_id FROM rides WHERE id = ?", rideId);
    if (ride?.status !== "recording") return;
    // A final TaskManager callback from the previous run may arrive as Android
    // is restarting the service. Never attach those fixes to the new run.
    const currentRunPoints = points.filter((point) => (point.runId ?? ride.run_id) === ride.run_id);
    if (currentRunPoints.length === 0) return;
    const seqRow = await tx.getFirstAsync<{ next_seq: number }>(
      "SELECT COALESCE(MAX(seq), -1) + 1 AS next_seq FROM ride_points WHERE ride_id = ?",
      rideId,
    );
    let seq = seqRow?.next_seq ?? 0;
    for (const point of currentRunPoints) {
      await tx.runAsync(
        `INSERT INTO ride_points (ride_id, seq, timestamp_ms, lat, lon, accuracy_m, speed_mps, run_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        rideId,
        seq++,
        point.ts,
        point.lat,
        point.lon,
        point.accuracy ?? null,
        point.speed ?? null,
        point.runId ?? 1,
      );
    }
    await tx.runAsync("UPDATE rides SET modified_at_ms = ? WHERE id = ?", Date.now(), rideId);
  });
}

export async function changeActiveRideStatus(
  status: "paused" | "completed",
): Promise<ActiveRideState | null> {
  const db = await getDatabase();
  const active = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM local_state WHERE key = ?",
    ACTIVE_RIDE_KEY,
  );
  if (!active) return null;
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<RideRow>("SELECT * FROM rides WHERE id = ?", active.value);
    if (!row || row.status === "saved") return;
    const elapsedMs = row.elapsed_ms + (row.run_started_at_ms ? Math.max(0, now - row.run_started_at_ms) : 0);
    await tx.runAsync(
      `UPDATE rides SET status = ?, ended_at_ms = ?, run_started_at_ms = NULL,
       elapsed_ms = ?, modified_at_ms = ? WHERE id = ?`,
      status,
      status === "completed" ? now : null,
      elapsedMs,
      now,
      row.id,
    );
  });
  return loadActiveRideForId(db, active.value);
}

export async function discardActiveRide(): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const active = await tx.getFirstAsync<{ value: string }>(
      "SELECT value FROM local_state WHERE key = ?",
      ACTIVE_RIDE_KEY,
    );
    if (active) await tx.runAsync("DELETE FROM rides WHERE id = ?", active.value);
    await tx.runAsync("DELETE FROM local_state WHERE key = ?", ACTIVE_RIDE_KEY);
  });
  await AsyncStorage.removeItem(ACTIVE_RIDE_MODE_KEY);
}

export async function setActiveRideMode(mode: RideMode): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_RIDE_MODE_KEY, mode);
}

export async function getActiveRideMode(): Promise<RideMode | null> {
  const value = await AsyncStorage.getItem(ACTIVE_RIDE_MODE_KEY);
  return value === "recordOnly" || value === "navigateAndRecord" ? value : null;
}

export async function clearActiveRideMode(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_RIDE_MODE_KEY);
}

export async function saveRideSummary(rideId: string, summary: RideSummaryPayload): Promise<void> {
  if (summary.clientRideId !== rideId) throw new Error("Ride summary ID does not match the local ride.");
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ status: string }>("SELECT status FROM rides WHERE id = ?", rideId);
    if (!row || row.status !== "completed") throw new Error("End the ride before saving its summary.");
    await tx.runAsync(
      `UPDATE rides SET status = 'saved', summary_json = ?, sync_state = 'pending_sync', modified_at_ms = ? WHERE id = ?`,
      JSON.stringify(summary),
      Date.now(),
      rideId,
    );
    await tx.runAsync("DELETE FROM local_state WHERE key = ?", ACTIVE_RIDE_KEY);
    await tx.runAsync(
      `INSERT INTO ride_sync_outbox (operation_id, client_ride_id, payload_json, attempt_count, created_at_ms)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(client_ride_id) DO UPDATE SET payload_json = excluded.payload_json`,
      rideId,
      rideId,
      JSON.stringify(summary),
      Date.now(),
    );
  });
  await clearActiveRideMode();
}

export async function listSavedLocalRides(limit = 50): Promise<LocalRideRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RideRow>(
    "SELECT * FROM rides WHERE status = 'saved' ORDER BY started_at_ms DESC LIMIT ?",
    Math.max(1, Math.min(limit, 200)),
  );
  const results: LocalRideRecord[] = [];
  for (const row of rows) {
    if (!row.summary_json) continue;
    const demoMode = demoModeForRideId(row.id);
    results.push({
      id: row.id,
      summary: JSON.parse(row.summary_json) as RideSummaryPayload,
      // Keep ride history lightweight. Load the full track only when a user
      // opens Share Studio or exports a GPX file.
      points: [],
      elapsedMs: row.elapsed_ms,
      syncState: row.sync_state,
      serverRideId: row.server_ride_id,
      ...(demoMode ? { demoMode } : {}),
    });
  }
  return results;
}

/** Insert clearly marked local preview rides without creating Convex outbox entries. */
export async function addDemoRidesToLocalHistory(): Promise<DemoRideFixture[]> {
  const db = await getDatabase();
  const fixtures = createDemoRideFixtures();
  for (const fixture of fixtures) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      const existing = await tx.getFirstAsync<{ id: string }>("SELECT id FROM rides WHERE id = ?", fixture.id);
      if (existing) return;
      const now = Date.now();
      await tx.runAsync(
        `INSERT INTO rides (id, started_at_ms, ended_at_ms, status, run_id, run_started_at_ms,
          elapsed_ms, interrupted, summary_json, sync_state, server_ride_id, modified_at_ms)
         VALUES (?, ?, ?, 'saved', 1, NULL, ?, 0, ?, 'local_only', NULL, ?)`,
        fixture.id,
        fixture.summary.startAt,
        fixture.summary.endAt,
        fixture.elapsedMs ?? 0,
        JSON.stringify(fixture.summary),
        now,
      );
      for (let seq = 0; seq < fixture.points.length; seq += 1) {
        const point = fixture.points[seq];
        await tx.runAsync(
          `INSERT INTO ride_points (ride_id, seq, timestamp_ms, lat, lon, accuracy_m, speed_mps, run_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          fixture.id,
          seq,
          point.ts,
          point.lat,
          point.lon,
          point.accuracy ?? null,
          point.speed ?? null,
          point.runId ?? 1,
        );
      }
    });
  }
  return fixtures;
}

export async function getSavedLocalRide(rideId: string): Promise<LocalRideRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RideRow>(
    "SELECT * FROM rides WHERE id = ? AND status = 'saved'",
    rideId,
  );
  if (!row?.summary_json) return null;
  return {
    id: row.id,
    summary: JSON.parse(row.summary_json) as RideSummaryPayload,
    points: await pointsForRide(db, row.id),
    ...(demoModeForRideId(row.id) ? { demoMode: demoModeForRideId(row.id)! } : {}),
    elapsedMs: row.elapsed_ms,
    syncState: row.sync_state,
    serverRideId: row.server_ride_id,
  };
}

export async function getDueRideOutbox(now = Date.now(), limit = 5): Promise<RideOutboxEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT * FROM ride_sync_outbox
     WHERE next_attempt_at_ms IS NULL OR next_attempt_at_ms <= ?
     ORDER BY created_at_ms ASC LIMIT ?`,
    now,
    Math.max(1, Math.min(limit, 20)),
  );
  return rows.map((row) => ({
    operationId: row.operation_id,
    clientRideId: row.client_ride_id,
    payload: JSON.parse(row.payload_json) as RideSummaryPayload,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at_ms,
  }));
}

export async function acknowledgeRideUpload(clientRideId: string, serverRideId: string): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "UPDATE rides SET sync_state = 'synced', server_ride_id = ?, modified_at_ms = ? WHERE id = ?",
      serverRideId,
      Date.now(),
      clientRideId,
    );
    await tx.runAsync("DELETE FROM ride_sync_outbox WHERE client_ride_id = ?", clientRideId);
  });
}

export async function deferRideUpload(
  clientRideId: string,
  attemptCount: number,
  nextAttemptAt: number,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE ride_sync_outbox SET attempt_count = ?, next_attempt_at_ms = ? WHERE client_ride_id = ?",
    attemptCount,
    nextAttemptAt,
    clientRideId,
  );
}

export async function deleteSavedLocalRide(rideId: string): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ status: string; sync_state: string }>(
      "SELECT status, sync_state FROM rides WHERE id = ?",
      rideId,
    );
    if (!row || row.status !== "saved") return;
    if (row.sync_state === "pending_sync") throw new Error("Wait for this ride summary to sync before removing its local track.");
    await tx.runAsync("DELETE FROM rides WHERE id = ?", rideId);
  });
}
