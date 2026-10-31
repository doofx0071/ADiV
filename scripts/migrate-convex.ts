/**
 * AdiV Convex migration tool — backs up or restores all app data (documents +
 * file blobs) using the public API, with document-id remapping on restore.
 *
 * Requires convex/adminMigration.ts to be deployed to the TARGET deployment.
 *
 * Usage (bun):
 *   bun scripts/migrate-convex.ts backup  <deployment-url> <out-file.json>
 *   bun scripts/migrate-convex.ts restore <deployment-url> <backup-file.json>
 *
 * backup  → writes <out-file.json> plus a sibling <out-dir>/files/ folder with
 *           every referenced storage blob.
 * restore → wipes the target deployment, re-uploads blobs, inserts documents
 *           with remapped ids, prints a verification summary.
 *
 * Note: the Android app and web app embed the deployment URL at build/dev
 * time — re-point .env files after migrating (see backups runbook).
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

interface AnyDoc {
  _id: string;
  [field: string]: unknown;
}

interface BackupPayload {
  exportedAt: string;
  sourceUrl: string;
  data: {
    bike: AnyDoc[];
    maintenanceItems: AnyDoc[];
    maintenanceLogs: AnyDoc[];
    rides: AnyDoc[];
    fuelLogs: AnyDoc[];
    expenses: AnyDoc[];
    achievements: AnyDoc[];
    files: AnyDoc[];
  };
}

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function asStorageId(id: string): Id<"_storage"> {
  return id as Id<"_storage">;
}

function collectStorageIds(data: BackupPayload["data"]): Set<string> {
  const ids = new Set<string>();
  for (const log of data.maintenanceLogs) {
    for (const photo of (log.photos as string[] | undefined) ?? []) ids.add(photo);
  }
  for (const expense of data.expenses) {
    if (typeof expense.receiptPhoto === "string") ids.add(expense.receiptPhoto);
  }
  for (const file of data.files) ids.add(file.storageId as string);
  return ids;
}

async function backup(url: string, outFile: string): Promise<void> {
  const client = new ConvexHttpClient(url);
  const data = (await client.query(api.adminMigration.exportAll)) as BackupPayload["data"];

  const counts = Object.fromEntries(
    Object.entries(data).map(([table, docs]) => [table, docs.length]),
  );
  console.log("Document counts:", counts);

  const storageIds = collectStorageIds(data);
  console.log(`Downloading ${storageIds.size} storage blob(s)...`);

  const filesDir = `${outFile.replace(/\.json$/i, "")}.files`;
  mkdirSync(filesDir, { recursive: true });

  const contentTypeById = new Map(
    data.files.map((file) => [file.storageId as string, file.type as string]),
  );

  let downloaded = 0;
  for (const storageId of storageIds) {
    const blobUrl = await client.query(api.files.getFileUrl, {
      storageId: asStorageId(storageId),
    });
    if (!blobUrl) {
      console.warn(`  ! ${storageId}: no URL (blob missing) — skipped`);
      continue;
    }
    const res = await fetch(blobUrl);
    if (!res.ok) {
      console.warn(`  ! ${storageId}: HTTP ${res.status} — skipped`);
      continue;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(filesDir, storageId), buffer);
    downloaded += 1;
    console.log(`  ✓ ${storageId} (${buffer.length} bytes, ${contentTypeById.get(storageId) ?? "unknown"})`);
  }

  const payload: BackupPayload = {
    exportedAt: new Date().toISOString(),
    sourceUrl: url,
    data,
  };
  writeFileSync(outFile, JSON.stringify(payload, null, 2));

  console.log("\nBackup complete:");
  console.log(`  documents → ${outFile}`);
  console.log(`  blobs     → ${filesDir}/ (${downloaded}/${storageIds.size})`);
  const blobDirName = basename(filesDir);
  console.log(`\nRestore later with:\n  bun scripts/migrate-convex.ts restore <new-url> ${outFile}  (blobs auto-read from ${blobDirName}/)`);
}

async function restore(url: string, backupFile: string): Promise<void> {
  const payload = JSON.parse(readFileSync(backupFile, "utf-8")) as BackupPayload;
  const filesDir = backupFile.replace(/\.json$/i, "") + ".files";

  const client = new ConvexHttpClient(url);
  console.log("Clearing target deployment...");
  await client.mutation(api.adminMigration.clearAll, {});

  // Re-upload every downloaded blob, mapping old storage id → new storage id
  const storageMap: Record<string, string> = {};
  const blobNames = readdirSync(filesDir);
  console.log(`Uploading ${blobNames.length} blob(s)...`);
  const contentTypeById = new Map(
    payload.data.files.map((file) => [file.storageId as string, file.type as string]),
  );
  for (const oldStorageId of blobNames) {
    const uploadUrl = await client.mutation(api.files.generateUploadUrl, {});
    const buffer = readFileSync(join(filesDir, oldStorageId));
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentTypeById.get(oldStorageId) ?? "application/octet-stream",
      },
      body: buffer,
    });
    if (!res.ok) fail(`Upload failed for ${oldStorageId}: HTTP ${res.status}`);
    const { storageId } = (await res.json()) as { storageId: string };
    storageMap[oldStorageId] = storageId;
    console.log(`  ✓ ${oldStorageId} → ${storageId}`);
  }

  console.log("Inserting documents with id remapping...");
  const result = (await client.mutation(api.adminMigration.importAll, {
    data: { ...payload.data, storageMap },
  })) as { inserted: Record<string, number>; dropped: Record<string, number> };

  console.log("\nRestore complete:");
  console.log("  inserted:", result.inserted);
  if (Object.keys(result.dropped).length > 0) {
    console.warn("  dropped references (source blob/doc missing):", result.dropped);
  }
  console.log(`\nVerify in the dashboard at ${url.replace(".convex.cloud", "")} → Data, then re-point web/mobile .env files.`);
}

const [mode, url, file] = process.argv.slice(2);
if (!url || !file || (mode !== "backup" && mode !== "restore")) {
  fail(
    "Usage:\n  bun scripts/migrate-convex.ts backup <deployment-url> <out-file.json>\n  bun scripts/migrate-convex.ts restore <deployment-url> <backup-file.json>",
  );
}

(mode === "backup" ? backup : restore)(url, file).catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
