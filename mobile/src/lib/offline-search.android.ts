import * as SQLite from "expo-sqlite";
import { getActiveOfflinePack } from "./offline-pack-manager";
import { makeFtsQuery } from "./offline-pack-contract";
import type { PlaceResult } from "./geocode";

interface SearchRow {
  name: string;
  aliases: string | null;
  category: string | null;
  admin: string | null;
  lat: number;
  lon: number;
}

let cachedDatabaseKey = "";
let cachedDatabasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function nativePathFromFileUri(uri: string): string {
  if (!uri.startsWith("file://")) throw new Error("The offline search index is not stored locally.");
  return decodeURIComponent(uri.slice("file://".length));
}

async function databaseFor(uri: string, key: string): Promise<SQLite.SQLiteDatabase> {
  if (cachedDatabaseKey === key && cachedDatabasePromise) return cachedDatabasePromise;
  const previous = cachedDatabasePromise;
  cachedDatabaseKey = "";
  cachedDatabasePromise = null;
  if (previous) void previous.then((database) => database.closeAsync()).catch(() => undefined);
  const segments = uri.split("/");
  const databaseName = decodeURIComponent(segments.pop() ?? "places.sqlite");
  const directoryUri = segments.join("/");
  cachedDatabaseKey = key;
  cachedDatabasePromise = SQLite.openDatabaseAsync(
    databaseName,
    { useNewConnection: true },
    nativePathFromFileUri(directoryUri),
  ).then(async (database) => {
    await database.execAsync("PRAGMA query_only = ON;");
    return database;
  }).catch((error) => {
    cachedDatabaseKey = "";
    cachedDatabasePromise = null;
    throw error;
  });
  return cachedDatabasePromise;
}

export async function searchOfflinePlaces(query: string): Promise<PlaceResult[]> {
  const match = makeFtsQuery(query);
  if (!match) return [];
  const pack = await getActiveOfflinePack();
  if (!pack) return [];
  const database = await databaseFor(pack.searchUri, `${pack.packId}@${pack.version}`);
  const rows = await database.getAllAsync<SearchRow>(
    `SELECT name, aliases, category, admin, lat, lon
     FROM places_fts
     WHERE places_fts MATCH ?
     ORDER BY bm25(places_fts), name COLLATE NOCASE
     LIMIT 12`,
    match,
  );
  return rows
    .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon))
    .map((row) => ({
      label: row.name,
      detail: [row.category?.split(":").slice(1).join(" ").replaceAll("_", " "), row.admin].filter(Boolean).join(" · "),
      lat: row.lat,
      lon: row.lon,
      source: "offline" as const,
    }));
}
