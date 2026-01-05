/**
 * Canonical Caption State Helper
 * 
 * Provides a single source of truth for determining which captions
 * should be used for copy, export, and handoff operations.
 * 
 * Pattern matches ACW/FAQ canonical state management.
 */

import type { CaptionItem } from "@/app/apps/image-caption-generator/types";

/**
 * Get the active captions list (canonical selector)
 * 
 * Returns edited captions if present, otherwise returns generated captions.
 * Never returns null; returns empty array when no captions are available.
 * 
 * @param generatedCaptions - The latest captions (CaptionItem[])
 * @param editedCaptions - User-edited captions (null if not edited)
 * @returns The active captions array (never null)
 */
export function getActiveCaptions(
  generatedCaptions: CaptionItem[],
  editedCaptions: CaptionItem[] | null
): CaptionItem[] {
  return editedCaptions ?? generatedCaptions;
}

