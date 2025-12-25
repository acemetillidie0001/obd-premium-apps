/**
 * OBD Social Auto-Poster - Image Request Builder
 * 
 * Builds ImageEngineRequest from post data and settings.
 */

import type { ImageEngineRequest } from "@/lib/image-engine/types";
import type { SocialPostDraft, ImageSettings } from "./types";
import type { ImageCategory } from "@/lib/image-engine/types";
import { mapToImagePlatform } from "./imagePlatformMap";
import { inferImageCategoryFromPost } from "./imageCategoryMap";

/**
 * Builds an ImageEngineRequest for a post.
 * 
 * @param post - Post draft
 * @param requestId - Stable request ID (should be cached)
 * @param imageSettings - Image settings from user
 * @param brandKit - Optional brand kit data
 * @param campaignType - Campaign type
 * @returns Image engine request
 */
export function buildImageRequest(
  post: Pick<SocialPostDraft, "platform" | "content" | "theme" | "reason">,
  requestId: string,
  imageSettings: ImageSettings,
  brandKit?: {
    primaryColorHex?: string;
    secondaryColorHex?: string;
    accentColorHex?: string;
    styleTone?: "modern" | "luxury" | "friendly" | "bold" | "clean";
    industry?: string;
  },
  campaignType?: "Everyday Post" | "Event" | "Limited-Time Offer" | "New Service Announcement"
): ImageEngineRequest {
  // Map platform
  const imagePlatform = mapToImagePlatform(post.platform);

  // Determine category
  let category: ImageCategory;
  if (imageSettings.imageCategoryMode === "auto") {
    category = inferImageCategoryFromPost(post, campaignType);
  } else {
    category = imageSettings.imageCategoryMode;
  }

  // Build intent summary (sanitized, no business name)
  const intentSummary = buildIntentSummary(post.content, post.reason);

  // Build request
  const request: ImageEngineRequest = {
    requestId,
    consumerApp: "social_auto_poster",
    platform: imagePlatform,
    category,
    intentSummary,
    allowTextOverlay: imageSettings.allowTextOverlay,
    safeMode: "strict",
  };

  // Add brand influence if available
  if (brandKit) {
    request.brand = {};
    if (brandKit.primaryColorHex) {
      request.brand.primaryColorHex = brandKit.primaryColorHex;
    }
    if (brandKit.secondaryColorHex) {
      request.brand.secondaryColorHex = brandKit.secondaryColorHex;
    }
    if (brandKit.accentColorHex) {
      request.brand.accentColorHex = brandKit.accentColorHex;
    }
    if (brandKit.styleTone) {
      request.brand.styleTone = brandKit.styleTone;
    }
    if (brandKit.industry) {
      request.brand.industry = brandKit.industry;
    }

    // Only include brand if it has at least one field
    if (Object.keys(request.brand).length === 0) {
      delete request.brand;
    }
  }

  // Add locale (always Ocala, FL for now)
  request.locale = {
    city: "Ocala",
    region: "Florida",
  };

  return request;
}

/**
 * Builds a sanitized intent summary from post content.
 * Removes business names and keeps it abstract.
 */
function buildIntentSummary(content: string, reason?: string): string {
  // Use reason if available, otherwise extract from content
  let summary = reason || content;

  // Remove common business name patterns (simple heuristic)
  // This is a basic sanitization - the engine will do more thorough checks
  summary = summary
    .replace(/\b(our|my|we|us)\s+(business|company|shop|store|restaurant|salon|firm)\b/gi, "")
    .trim();

  // Limit length
  if (summary.length > 200) {
    summary = summary.substring(0, 197) + "...";
  }

  return summary || "Abstract visual for social media post";
}

