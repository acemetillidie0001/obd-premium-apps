/**
 * OBD Brand-Safe Image Generator - Alt Text Builder
 * 
 * Builds generic, accessibility-safe alt text for images.
 * Alt text is safe to persist (no business names, no claims).
 */

import type { PromptBuildInput } from "./types";

/**
 * Gets category description for alt text.
 */
function getCategoryDescription(category: string): string {
  switch (category) {
    case "evergreen":
      return "brand pattern";
    case "promo":
      return "promotional";
    case "event":
      return "event";
    case "review":
      return "trust and quality";
    case "seasonal":
      return "seasonal";
    case "announcement":
      return "announcement";
    default:
      return "brand-safe";
  }
}

/**
 * Gets aspect description for alt text.
 */
function getAspectDescription(aspect: string): string {
  switch (aspect) {
    case "1:1":
      return "square layout";
    case "4:5":
      return "vertical layout";
    case "16:9":
      return "wide landscape layout";
    case "4:3":
      return "landscape layout";
    default:
      return "standard layout";
  }
}

/**
 * Gets platform description for alt text.
 */
function getPlatformDescription(platform: string): string {
  switch (platform) {
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "x":
      return "X (Twitter)";
    case "google_business_profile":
      return "Google Business Profile";
    case "website":
      return "website";
    default:
      return "social media";
  }
}

/**
 * Builds generic, accessibility-safe alt text.
 * 
 * Rules:
 * - Generic and descriptive
 * - Accessibility-safe
 * - NO business names
 * - NO marketing claims
 * - NO calls to action
 * 
 * @param input - Alt text build input
 * @returns Generic alt text string (safe to persist)
 */
export function buildAltText(input: {
  platform: string;
  category: string;
  aspect: string;
}): string {
  const { platform, category, aspect } = input;

  const categoryDesc = getCategoryDescription(category);
  const aspectDesc = getAspectDescription(aspect);
  const platformDesc = getPlatformDescription(platform);

  return `Abstract ${categoryDesc} image designed for ${platformDesc} in a ${aspectDesc}`;
}

