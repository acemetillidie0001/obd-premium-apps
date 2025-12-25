/**
 * OBD Social Auto-Poster - Image Platform Mapping
 * 
 * Maps Social Auto-Poster platform names to Image Engine platform names.
 */

import type { SocialPlatform } from "./types";
import type { ImagePlatform } from "@/lib/image-engine/types";

/**
 * Maps Social Auto-Poster platform to Image Engine platform.
 */
export function mapToImagePlatform(platform: SocialPlatform): ImagePlatform {
  switch (platform) {
    case "facebook":
      return "facebook";
    case "instagram":
      return "instagram";
    case "x":
      return "x";
    case "googleBusiness":
      return "google_business_profile";
    default:
      return "instagram"; // Safe default
  }
}

