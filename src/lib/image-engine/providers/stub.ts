/**
 * OBD Brand-Safe Image Generator - Stub Provider
 * 
 * Development fallback provider that returns a placeholder image.
 * Used when no real provider is available or configured.
 */

import type { ImageProvider } from "../types";

/**
 * Creates a simple 1x1 pixel PNG placeholder.
 */
function createPlaceholderImage(
  width: number,
  height: number
): Uint8Array {
  // Minimal valid PNG: 1x1 transparent pixel
  // This is a base64-encoded 1x1 transparent PNG
  const base64PNG =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const binary = Buffer.from(base64PNG, "base64");
  return new Uint8Array(binary);
}

export const stubProvider: ImageProvider = {
  id: "other",
  async generate(args) {
    // Return a placeholder image
    const bytes = createPlaceholderImage(args.width, args.height);
    return {
      bytes,
      contentType: "image/png",
      width: args.width,
      height: args.height,
    };
  },
};

