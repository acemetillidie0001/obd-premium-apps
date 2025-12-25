/**
 * OBD Brand-Safe Image Generator - Vercel Blob Storage
 * 
 * Real implementation using Vercel Blob for production image storage.
 * Returns absolute HTTPS URLs for stable image access.
 */

import type { StorageWriteInput, StorageWriteOutput } from "./types";

/**
 * Determines file extension from MIME type.
 * 
 * @param mimeType - MIME type (e.g., "image/png")
 * @param providedExt - Optional explicit extension override
 * @returns File extension without dot
 */
function getExtension(mimeType: string, providedExt?: string): string {
  if (providedExt) {
    return providedExt.replace(/^\./, ""); // Remove leading dot if present
  }

  // Map common MIME types to extensions
  const mimeToExt: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
  };

  return mimeToExt[mimeType.toLowerCase()] || "png";
}

/**
 * Writes image bytes to Vercel Blob storage.
 * 
 * @param input - Storage write input
 * @returns Storage write output
 */
export async function writeToVercelBlob(
  input: StorageWriteInput
): Promise<StorageWriteOutput> {
  // Check for API token
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || token.trim().length === 0) {
    return {
      ok: false,
      storage: "vercel_blob",
      errorCode: "MISSING_BLOB_TOKEN",
      errorMessageSafe: "Vercel Blob token not configured",
    };
  }

  try {
    const { requestId, bytes, mimeType, ext } = input;

    // Determine file extension
    const fileExt = getExtension(mimeType, ext);

    // Sanitize requestId for blob key safety
    const safeRequestId = requestId.replace(/[^a-zA-Z0-9-_]/g, "_");

    // Build blob key
    const blobKey = `obd-image-engine/${safeRequestId}.${fileExt}`;

    // Import @vercel/blob
    const { put } = await import("@vercel/blob");

    // Upload to Vercel Blob
    // Note: bytes is a Buffer, which is compatible with @vercel/blob's PutBody type
    const result = await put(blobKey, bytes, {
      contentType: mimeType,
      access: "public",
      token,
    });

    // Return absolute URL from Vercel Blob
    return {
      ok: true,
      storage: "vercel_blob",
      url: result.url, // Absolute HTTPS URL from Vercel
      meta: {
        sizeBytes: bytes.length,
        contentType: mimeType,
        blobKey,
      },
    };
  } catch (error) {
    // Handle network errors, API errors, etc.
    const errorMessage =
      error instanceof Error ? error.message : "Unknown storage error";

    // Determine error code based on error type
    let errorCode = "BLOB_WRITE_ERROR";
    if (errorMessage.includes("token") || errorMessage.includes("unauthorized")) {
      errorCode = "BLOB_AUTH_ERROR";
    } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      errorCode = "BLOB_NETWORK_ERROR";
    }

    return {
      ok: false,
      storage: "vercel_blob",
      errorCode,
      errorMessageSafe: `Vercel Blob upload failed: ${errorMessage}`,
    };
  }
}

