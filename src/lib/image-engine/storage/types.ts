/**
 * OBD Brand-Safe Image Generator - Storage Types
 * 
 * Unified storage interface for image persistence.
 */

export type StorageName = "local_dev" | "vercel_blob" | "remote_stub";

export interface StorageWriteInput {
  requestId: string;
  bytes: Buffer;
  mimeType: string;
  ext?: string;
}

export interface StorageWriteOutput {
  ok: boolean;
  storage: StorageName;
  url?: string;
  errorCode?: string;
  errorMessageSafe?: string;
  meta?: Record<string, unknown>;
}

