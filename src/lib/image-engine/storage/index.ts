/**
 * OBD Brand-Safe Image Generator - Storage Registry
 * 
 * Manages storage adapter selection based on environment.
 */

import type { ImageStorage } from "../types";
import { localDevStorage } from "./localDev";
import { vercelBlobStorage } from "./vercelBlob";
import type { StorageName, StorageWriteInput, StorageWriteOutput } from "./types";
import { writeToLocalDev } from "./local-dev";
import { writeToVercelBlob } from "./vercel-blob";
import { writeToRemoteStub } from "./remote-stub";

/**
 * Gets the appropriate storage adapter based on environment.
 * 
 * - Development: local file system storage
 * - Production: Vercel Blob (if available) or local fallback
 * 
 * @returns Storage adapter instance
 */
export function getStorage(): ImageStorage {
  const isProduction = process.env.NODE_ENV === "production";
  const hasVercelBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

  if (isProduction && hasVercelBlob) {
    return vercelBlobStorage;
  }

  // Default to local dev storage
  return localDevStorage;
}

/**
 * Writes image bytes to the specified storage backend.
 * 
 * Unified entry point for storage operations.
 * 
 * @param storage - Storage backend name
 * @param input - Storage write input
 * @returns Storage write output
 */
export async function writeToStorage(
  storage: StorageName,
  input: StorageWriteInput
): Promise<StorageWriteOutput> {
  switch (storage) {
    case "local_dev":
      return await writeToLocalDev(input);
    case "vercel_blob":
      return await writeToVercelBlob(input);
    case "remote_stub":
      return await writeToRemoteStub(input);
    default:
      return {
        ok: false,
        storage: "local_dev", // Default fallback
        errorCode: "UNKNOWN_STORAGE",
        errorMessageSafe: `Unknown storage backend: ${storage}`,
      };
  }
}

