/**
 * OBD Brand-Safe Image Generator - Remote Storage Stub
 * 
 * Placeholder for future S3/R2/Cloud storage implementation.
 * Returns safe error until configured.
 */

import type { StorageWriteInput, StorageWriteOutput } from "./types";

/**
 * Writes image bytes to remote storage (stub).
 * 
 * @param input - Storage write input
 * @returns Storage write output (always returns error for now)
 */
export async function writeToRemoteStub(
  input: StorageWriteInput
): Promise<StorageWriteOutput> {
  // Stub implementation - returns safe error
  return {
    ok: false,
    storage: "remote_stub",
    errorCode: "NOT_CONFIGURED",
    errorMessageSafe: "Remote storage not configured yet",
  };
}

