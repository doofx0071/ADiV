import Constants from "expo-constants";
import { Directory, File, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import {
  assertMinimumAppVersion,
  parseOfflinePackManifest,
  resolveOfflineStyle,
  validateOfflineStyle,
  type InstalledOfflinePack,
  type OfflinePackManifest,
  type PackVerificationResult,
} from "./offline-pack-contract";

const PACKS_DIRECTORY_NAME = "adiv-offline-packs";
const ACTIVE_PACK_FILENAME = "active-pack.json";
const MIN_FREE_SPACE_BYTES = 48 * 1024 * 1024;

interface ActivePackReference {
  packId: string;
  version: string;
}

const packsRoot = new Directory(Paths.document, PACKS_DIRECTORY_NAME);

function assertAndroid(): void {
  if (Platform.OS !== "android") throw new Error("Offline map packs are supported on Android only.");
}

function ensureRoot(): void {
  if (!packsRoot.exists) packsRoot.create({ intermediates: true, idempotent: true });
}

function versionDirectory(packId: string, version: string): Directory {
  return new Directory(packsRoot, packId, version);
}

function assertPackIdentity(packId: string, version: string): void {
  if (!/^ph-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packId) || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("The offline pack identity is invalid.");
  }
}

function fileAt(root: Directory, relativePath: string): File {
  return new File(root, ...relativePath.split("/"));
}

function ensureDestinationParent(file: File): void {
  const parent = file.parentDirectory;
  if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
  if (!parent.exists) throw new Error(`The staging folder for ${file.name} could not be created.`);
}

function nativePathFromFileUri(uri: string): string {
  if (!uri.startsWith("file://")) throw new Error("The search index must be stored in the app's local files.");
  return decodeURIComponent(uri.slice("file://".length));
}

function toInstalledPack(manifest: OfflinePackManifest, directory: Directory): InstalledOfflinePack {
  return {
    packId: manifest.packId,
    version: manifest.version,
    name: manifest.name,
    region: manifest.region,
    dataDate: manifest.dataDate,
    coverage: manifest.coverage,
    attribution: manifest.attribution,
    mapUri: fileAt(directory, manifest.assets.map).uri,
    styleUri: fileAt(directory, manifest.assets.style).uri,
    searchUri: fileAt(directory, manifest.assets.search).uri,
    routingAvailable: false,
    directoryUri: directory.uri,
    sizeBytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
  };
}

async function readManifest(directory: Directory): Promise<OfflinePackManifest> {
  // A directory returned by Android's system picker is a Storage Access
  // Framework tree URI. Resolve its children from list() so the document
  // provider's child URIs are preserved; joining "manifest.json" onto the
  // tree URI does not address the selected document on all providers.
  const entries = directory.list();
  const manifestFile = entries.find((entry) => entry instanceof File && entry.name === "manifest.json");
  if (!(manifestFile instanceof File)) {
    const found = entries.map((entry) => entry.name).slice(0, 8).join(", ");
    throw new Error(`This folder has no manifest.json. Select the ADiV pack folder itself. Found: ${found || "no files"}.`);
  }
  const value: unknown = JSON.parse(await manifestFile.text());
  return parseOfflinePackManifest(value);
}

function requiredManifestFiles(manifest: OfflinePackManifest): Set<string> {
  return new Set(manifest.files.map((file) => file.path));
}

async function copyPackTree(
  source: Directory,
  destination: Directory,
  allowedFiles: Set<string>,
  prefix = "",
): Promise<void> {
  for (const entry of source.list()) {
    if (!entry.name || entry.name.includes("/") || entry.name.includes("\\") || entry.name === "." || entry.name === "..") {
      throw new Error("The selected pack contains an unsafe file name.");
    }
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry instanceof Directory) {
      if (![...allowedFiles].some((path) => path.startsWith(`${relative}/`))) {
        throw new Error(`The selected pack contains an unlisted folder: ${relative}.`);
      }
      const nextDestination = new Directory(destination, entry.name);
      if (!nextDestination.exists) nextDestination.create({ intermediates: true, idempotent: true });
      if (!nextDestination.exists) throw new Error(`The staging folder for ${relative} could not be created.`);
      await copyPackTree(entry, nextDestination, allowedFiles, relative);
      continue;
    }
    if (relative !== "manifest.json" && !allowedFiles.has(relative)) {
      throw new Error(`The selected pack contains an unlisted file: ${relative}.`);
    }
    // `destination` mirrors the current source directory because recursion
    // already created each parent directory. Append only this entry's name;
    // using the full relative path here would duplicate nested segments
    // (for example `map/map/davao.pmtiles`).
    const destinationFile = new File(destination, entry.name);
    ensureDestinationParent(destinationFile);
    try {
      await entry.copy(destinationFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown file-system error";
      throw new Error(`Could not copy ${relative} into the offline pack staging folder: ${message}`);
    }
  }
}

async function validateSearchIndex(searchFile: File): Promise<void> {
  if (!searchFile.exists) throw new Error("The pack's offline search database is missing.");
  const database = await SQLite.openDatabaseAsync(
    searchFile.name,
    { useNewConnection: true },
    nativePathFromFileUri(searchFile.parentDirectory.uri),
  );
  try {
    await database.execAsync("PRAGMA query_only = ON;");
    const table = await database.getFirstAsync<{ sql: string | null }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'places_fts'",
    );
    if (!table?.sql?.toLowerCase().includes("using fts5")) {
      throw new Error("The search database must contain the places_fts FTS5 table.");
    }
    const schema = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    if (schema?.user_version !== 2) throw new Error("The offline place index must use search schema version 2.");
    await database.getAllAsync(
      "SELECT name, aliases, category, admin, lat, lon FROM places_fts WHERE places_fts MATCH ? LIMIT 1",
      '"adivpackprobe"*',
    );
  } finally {
    await database.closeAsync();
  }
}

async function verifyDirectory(directory: Directory, manifest: OfflinePackManifest): Promise<void> {
  for (const entry of manifest.files) {
    const file = fileAt(directory, entry.path);
    if (!file.exists) throw new Error(`Pack file is missing: ${entry.path}.`);
    if (file.size !== entry.bytes) throw new Error(`Pack file size does not match the manifest: ${entry.path}.`);
    const actual = await file.digest("SHA-256");
    if (actual.toLowerCase() !== entry.sha256.toLowerCase()) {
      throw new Error(`Pack checksum failed: ${entry.path}.`);
    }
  }
  const styleFile = fileAt(directory, manifest.assets.style);
  validateOfflineStyle(await styleFile.text());
  await validateSearchIndex(fileAt(directory, manifest.assets.search));
}

async function readActiveReference(): Promise<ActivePackReference | null> {
  ensureRoot();
  const file = new File(packsRoot, ACTIVE_PACK_FILENAME);
  if (!file.exists) return null;
  try {
    const value = JSON.parse(await file.text()) as Partial<ActivePackReference>;
    if (typeof value.packId !== "string" || typeof value.version !== "string") return null;
    assertPackIdentity(value.packId, value.version);
    return { packId: value.packId, version: value.version };
  } catch (error) {
    throw new Error(`The active offline map selection is damaged: ${error instanceof Error ? error.message : "invalid reference"}`);
  }
}

async function writeActiveReference(reference: ActivePackReference | null): Promise<void> {
  ensureRoot();
  const activeFile = new File(packsRoot, ACTIVE_PACK_FILENAME);
  const temporary = new File(packsRoot, `active-pack-${Date.now()}.tmp`);
  await temporary.write(reference ? JSON.stringify(reference) : "{}");
  await temporary.move(activeFile, { overwrite: true });
}

export async function getActiveOfflinePack(): Promise<InstalledOfflinePack | null> {
  if (Platform.OS !== "android") return null;
  const active = await readActiveReference();
  if (!active) return null;
  try {
    const directory = versionDirectory(active.packId, active.version);
    const manifest = await readManifest(directory);
    const pack = toInstalledPack(manifest, directory);
    if (!new File(pack.mapUri).exists || !new File(pack.styleUri).exists || !new File(pack.searchUri).exists || !fileAt(directory, manifest.assets.poi).exists) {
      throw new Error("A required map, style, search, or place-label file is missing.");
    }
    return pack;
  } catch (error) {
    throw new Error(`The active offline map pack could not be opened: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

export async function getActiveOfflineMapStyle(): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  const active = await readActiveReference();
  if (!active) return null;
  try {
    const directory = versionDirectory(active.packId, active.version);
    const manifest = await readManifest(directory);
    const style = await fileAt(directory, manifest.assets.style).text();
    return resolveOfflineStyle(style, directory.uri, manifest);
  } catch (error) {
    throw new Error(`The active offline map style could not be loaded: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

export async function listOfflinePacks(): Promise<InstalledOfflinePack[]> {
  if (Platform.OS !== "android") return [];
  ensureRoot();
  const packs: InstalledOfflinePack[] = [];
  for (const packEntry of packsRoot.list()) {
    if (!(packEntry instanceof Directory) || !/^ph-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packEntry.name)) continue;
    for (const versionEntry of packEntry.list()) {
      if (!(versionEntry instanceof Directory)) continue;
      try {
        const manifest = await readManifest(versionEntry);
        packs.push(toInstalledPack(manifest, versionEntry));
      } catch {
        // Staging and invalid folders are not installed packs.
      }
    }
  }
  return packs.sort((a, b) => a.name.localeCompare(b.name) || b.version.localeCompare(a.version));
}

export async function getActiveOfflineMap(): Promise<{ pack: InstalledOfflinePack; style: string } | null> {
  if (Platform.OS !== "android") return null;
  const active = await readActiveReference();
  if (!active) return null;
  try {
    const directory = versionDirectory(active.packId, active.version);
    const manifest = await readManifest(directory);
    const pack = toInstalledPack(manifest, directory);
    if (!new File(pack.mapUri).exists || !new File(pack.searchUri).exists || !fileAt(directory, manifest.assets.poi).exists) {
      throw new Error("A required map, search, or place-label file is missing.");
    }
    const styleText = await fileAt(directory, manifest.assets.style).text();
    validateOfflineStyle(styleText);
    return { pack, style: resolveOfflineStyle(styleText, directory.uri, manifest) };
  } catch (error) {
    throw new Error(`The active offline map pack could not be loaded: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

export async function importOfflinePackFromFolder(): Promise<InstalledOfflinePack> {
  assertAndroid();
  ensureRoot();
  const source = await Directory.pickDirectoryAsync();
  const manifest = await readManifest(source);
  assertMinimumAppVersion(manifest.minimumAppVersion, Constants.expoConfig?.version ?? "0.0.0");

  const totalBytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  if (Paths.availableDiskSpace < totalBytes + Math.max(MIN_FREE_SPACE_BYTES, Math.ceil(totalBytes * 0.05))) {
    throw new Error("There is not enough free storage to install this pack while preserving the current one.");
  }

  const stage = new Directory(packsRoot, `.staging-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  stage.create({ intermediates: true, idempotent: true });
  try {
    await copyPackTree(source, stage, requiredManifestFiles(manifest));
    await verifyDirectory(stage, manifest);

    const parent = new Directory(packsRoot, manifest.packId);
    if (!parent.exists) parent.create();
    const installedDirectory = versionDirectory(manifest.packId, manifest.version);
    if (installedDirectory.exists) {
      const installedManifest = await readManifest(installedDirectory);
      const currentChecksums = new Map(installedManifest.files.map((file) => [file.path, file.sha256]));
      const sameContents = manifest.files.every((file) => currentChecksums.get(file.path) === file.sha256);
      if (!sameContents || installedManifest.files.length !== manifest.files.length) {
        throw new Error("This pack version is already installed with different contents. Publish a new version.");
      }
      stage.delete();
    } else {
      await stage.move(installedDirectory);
    }

    // The new directory is complete before the pointer changes. If this write fails,
    // the prior active pack remains selected and the newly installed version is harmless.
    await writeActiveReference({ packId: manifest.packId, version: manifest.version });
    return toInstalledPack(manifest, installedDirectory);
  } catch (error) {
    if (stage.exists) stage.delete();
    throw error;
  }
}

export async function activateOfflinePack(packId: string, version: string): Promise<void> {
  assertAndroid();
  assertPackIdentity(packId, version);
  const directory = versionDirectory(packId, version);
  const manifest = await readManifest(directory);
  await verifyDirectory(directory, manifest);
  await writeActiveReference({ packId, version });
}

export async function verifyOfflinePack(packId: string, version: string): Promise<PackVerificationResult> {
  if (Platform.OS !== "android") return { valid: false, error: "Offline map pack verification requires Android." };
  try {
    assertPackIdentity(packId, version);
    const directory = versionDirectory(packId, version);
    const manifest = await readManifest(directory);
    await verifyDirectory(directory, manifest);
    return { valid: true, pack: toInstalledPack(manifest, directory) };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Pack verification failed." };
  }
}

export async function deleteOfflinePack(packId: string, version: string): Promise<void> {
  assertAndroid();
  assertPackIdentity(packId, version);
  const active = await readActiveReference();
  if (active?.packId === packId && active.version === version) {
    throw new Error("Choose another map pack before deleting the active pack.");
  }
  const directory = versionDirectory(packId, version);
  if (directory.exists) directory.delete();
}

export async function getOfflinePackSearchIndex(packId: string, version: string): Promise<OfflinePackManifest | null> {
  try {
    return await readManifest(versionDirectory(packId, version));
  } catch {
    return null;
  }
}
