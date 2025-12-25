/**
 * OBD Brand-Safe Image Generator - Local Development Storage
 * 
 * Writes generated images to public/generated/ directory.
 * Cross-platform safe (Windows + macOS).
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
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
 * Writes image bytes to local development storage.
 * 
 * @param input - Storage write input
 * @returns Storage write output
 */
export async function writeToLocalDev(
  input: StorageWriteInput
): Promise<StorageWriteOutput> {
  try {
    const { requestId, bytes, mimeType, ext } = input;

    // Determine file extension
    const fileExt = getExtension(mimeType, ext);

    // Sanitize requestId for filesystem safety
    const safeRequestId = requestId.replace(/[^a-zA-Z0-9-_]/g, "_");

    // Build file path
    const filename = `${safeRequestId}.${fileExt}`;
    const publicDir = join(process.cwd(), "public", "generated");
    const filePath = join(publicDir, filename);

    // Ensure directory exists (recursive)
    await mkdir(publicDir, { recursive: true });

    // Write file
    await writeFile(filePath, bytes);

    // Return public URL (relative to /public)
    const url = `/generated/${filename}`;

    return {
      ok: true,
      storage: "local_dev",
      url,
      meta: {
        filename,
        mimeType,
        size: bytes.length,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown storage error";

    return {
      ok: false,
      storage: "local_dev",
      errorCode: "WRITE_ERROR",
      errorMessageSafe: `Local storage write failed: ${errorMessage}`,
    };
  }
}

