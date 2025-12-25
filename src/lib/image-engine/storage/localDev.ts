/**
 * OBD Brand-Safe Image Generator - Local Development Storage
 * 
 * Stores generated images in /public/generated/ directory for local development.
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { ImageStorage } from "../types";

/**
 * Generates a deterministic storage key from request metadata.
 */
function generateStorageKey(
  requestId: string,
  platform: string,
  category: string,
  timestamp?: number
): string {
  const ts = timestamp || Date.now();
  // Sanitize requestId for filesystem safety
  const safeRequestId = requestId.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${safeRequestId}-${platform}-${category}-${ts}.png`;
}

/**
 * Local development storage adapter.
 * Writes images to /public/generated/ directory.
 */
export const localDevStorage: ImageStorage = {
  async put(args) {
    const { key, bytes, contentType } = args;

    // Determine file extension from content type
    const ext = contentType.split("/")[1] || "png";
    const filename = key.endsWith(`.${ext}`) ? key : `${key}.${ext}`;

    // Path relative to project root
    const publicDir = join(process.cwd(), "public", "generated");
    const filePath = join(publicDir, filename);

    try {
      // Ensure directory exists
      await mkdir(publicDir, { recursive: true });

      // Write file
      await writeFile(filePath, bytes);

      // Return public URL (relative to /public)
      const url = `/generated/${filename}`;

      return { url };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown storage error";
      throw new Error(`Local storage error: ${message}`);
    }
  },
};

// Export helper for key generation
export { generateStorageKey };

