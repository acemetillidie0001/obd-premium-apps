/**
 * OBD Brand-Safe Image Generator - Size Resolution
 * 
 * Resolves image dimensions based on platform and aspect ratio.
 */

import type { ImagePlatform, ImageAspect } from "./types";

/**
 * Standard image sizes for each aspect ratio.
 * 
 * Choices:
 * - 1:1 => 1024x1024 (standard square, good for Instagram)
 * - 4:5 => 1024x1280 (vertical, optimized for Instagram posts)
 * - 16:9 => 1280x720 (widescreen, good for blogs and X)
 * - 4:3 => 1200x900 (classic ratio, good for Google Business Profile)
 */
const ASPECT_SIZE_MAP: Record<ImageAspect, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 1024, height: 1280 },
  "16:9": { width: 1280, height: 720 },
  "4:3": { width: 1200, height: 900 },
};

/**
 * Resolves image dimensions based on platform and aspect ratio.
 * 
 * @param platform - Target platform
 * @param aspect - Aspect ratio from decision
 * @returns Width and height in pixels
 */
export function resolveSize(
  platform: ImagePlatform,
  aspect: ImageAspect
): { width: number; height: number } {
  return ASPECT_SIZE_MAP[aspect];
}

