/**
 * Caption Mapper Utilities
 * 
 * Maps between API Caption type and internal CaptionItem type.
 * Provides conversion functions for canonical state management.
 */

import type { Caption, CaptionLength, GoalOption, VariationMode } from "@/app/apps/image-caption-generator/types";
import type { CaptionItem } from "@/app/apps/image-caption-generator/types";

/**
 * Normalize platform name to lowercase string
 */
function normalizePlatform(platform: string): string {
  return platform.toLowerCase().replace(/\s+/g, "");
}

/**
 * Normalize length mode to lowercase
 */
function normalizeLength(length: CaptionLength): "short" | "medium" | "long" {
  return length.toLowerCase() as "short" | "medium" | "long";
}

/**
 * Map API Caption to internal CaptionItem
 * 
 * @param caption - API Caption from response
 * @param goal - Goal from request/meta (optional)
 * @returns CaptionItem for internal state management
 */
export function mapCaptionToItem(
  caption: Caption,
  goal?: GoalOption | string | null
): CaptionItem {
  // Ensure stable string ID: use caption.id if present, otherwise generate UUID
  let stableId: string;
  if (caption.id !== undefined && caption.id !== null) {
    stableId = String(caption.id);
  } else {
    // Generate stable UUID if ID is missing (shouldn't happen with current API, but safe fallback)
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      stableId = crypto.randomUUID();
    } else {
      // Fallback for environments without crypto.randomUUID
      stableId = `caption_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  }

  return {
    id: stableId,
    platform: normalizePlatform(caption.platform),
    goal: goal ?? null,
    tone: null, // Not available in current API response
    length: normalizeLength(caption.lengthMode),
    caption: caption.text, // Map "text" to "caption"
    hashtags: caption.hashtags.length > 0 ? caption.hashtags : null,
    createdAt: Date.now(), // Local timestamp
    // Preserve display fields
    label: caption.label,
    lengthMode: caption.lengthMode,
    variationMode: caption.variationMode,
    previewHint: caption.previewHint,
  };
}

/**
 * Map array of API Captions to CaptionItems
 * 
 * @param captions - Array of API Captions
 * @param goal - Goal from request/meta (optional)
 * @returns Array of CaptionItems
 */
export function mapCaptionsToItems(
  captions: Caption[],
  goal?: GoalOption | string | null
): CaptionItem[] {
  return captions.map((caption) => mapCaptionToItem(caption, goal));
}

