import type { InstalledOfflinePack, OfflinePackManifest, PackVerificationResult } from "./offline-pack-contract";

export type { InstalledOfflinePack, OfflinePackManifest, PackVerificationResult } from "./offline-pack-contract";

export async function listOfflinePacks(): Promise<InstalledOfflinePack[]> {
  return [];
}

export async function getActiveOfflinePack(): Promise<InstalledOfflinePack | null> {
  return null;
}

export async function getActiveOfflineMapStyle(): Promise<string | null> {
  return null;
}

export async function getActiveOfflineMap(): Promise<{ pack: InstalledOfflinePack; style: string } | null> {
  return null;
}

export async function importOfflinePackFromFolder(): Promise<InstalledOfflinePack> {
  throw new Error("Offline map packs can only be imported in an Android development build.");
}

export async function activateOfflinePack(_packId: string, _version: string): Promise<void> {
  throw new Error("Offline map packs can only be managed in an Android development build.");
}

export async function verifyOfflinePack(_packId: string, _version: string): Promise<PackVerificationResult> {
  return { valid: false, error: "Offline map pack verification requires Android." };
}

export async function deleteOfflinePack(_packId: string, _version: string): Promise<void> {
  throw new Error("Offline map packs can only be managed in an Android development build.");
}

export async function getOfflinePackSearchIndex(_packId: string, _version: string): Promise<OfflinePackManifest | null> {
  return null;
}
