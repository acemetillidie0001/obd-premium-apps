/**
 * Caption Export Formatters
 * 
 * Utility functions for formatting captions for export/copy operations.
 * Provides reusable formatting logic for bulk copy actions.
 */

import type { CaptionItem } from "@/app/apps/image-caption-generator/types";

/**
 * Format captions as plain text, grouped by platform
 * 
 * @param captions - Array of captions to format
 * @returns Formatted string with platform headers, captions, and hashtags
 * 
 * @example
 * === Facebook ===
 * Caption text here
 * #tag1 #tag2
 * 
 * === Instagram ===
 * Another caption
 */
export function formatCaptionsPlain(captions: CaptionItem[]): string {
  if (captions.length === 0) return "";

  // Group captions by platform
  const groupedByPlatform = new Map<string, CaptionItem[]>();
  for (const caption of captions) {
    const platform = caption.platform || "Generic";
    if (!groupedByPlatform.has(platform)) {
      groupedByPlatform.set(platform, []);
    }
    groupedByPlatform.get(platform)!.push(caption);
  }

  // Format output with platform headers
  const parts: string[] = [];
  const platformKeys = Array.from(groupedByPlatform.keys());
  
  for (let platformIndex = 0; platformIndex < platformKeys.length; platformIndex++) {
    const platform = platformKeys[platformIndex];
    const platformCaptions = groupedByPlatform.get(platform)!;
    
    // Platform header (capitalize first letter)
    const platformHeader = platform.charAt(0).toUpperCase() + platform.slice(1);
    parts.push(`=== ${platformHeader} ===`);

    // Add each caption
    for (let captionIndex = 0; captionIndex < platformCaptions.length; captionIndex++) {
      const caption = platformCaptions[captionIndex];
      parts.push(caption.caption);
      
      // Add hashtags if present
      if (caption.hashtags && caption.hashtags.length > 0) {
        const hashtagsText = caption.hashtags.join(" ");
        parts.push(hashtagsText);
      }
      
      // Blank line between captions (except after last caption in group)
      if (captionIndex < platformCaptions.length - 1) {
        parts.push("");
      }
    }

    // Blank line between platforms (except after last platform)
    if (platformIndex < platformKeys.length - 1) {
      parts.push("");
    }
  }

  return parts.join("\n");
}

/**
 * Pick selected captions from active captions, preserving original order
 * 
 * @param activeCaptions - All active captions
 * @param selectedIds - Set of selected caption IDs
 * @returns Array of selected captions in original order
 */
export function pickSelectedCaptions(
  activeCaptions: CaptionItem[],
  selectedIds: Set<string>
): CaptionItem[] {
  return activeCaptions.filter((caption) => selectedIds.has(caption.id));
}

/**
 * Escape CSV field value
 * Handles quotes, commas, and newlines
 */
function escapeCsvField(field: string): string {
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (field.includes(",") || field.includes('"') || field.includes("\n") || field.includes("\r")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Format captions as CSV
 * 
 * @param captions - Array of captions to format
 * @returns CSV string with headers: caption,platform,goal,hashtags
 * 
 * @example
 * caption,platform,goal,hashtags
 * "Caption text here","facebook","Awareness","#tag1 #tag2"
 */
export function formatCaptionsCsv(captions: CaptionItem[]): string {
  if (captions.length === 0) return "caption,platform,goal,hashtags\n";

  const rows: string[] = [];
  
  // Header row
  rows.push("caption,platform,goal,hashtags");

  // Data rows
  for (const caption of captions) {
    const captionText = escapeCsvField(caption.caption);
    const platform = escapeCsvField(caption.platform || "");
    const goal = escapeCsvField(caption.goal || "");
    
    // Format hashtags: space-joined with # prefix
    const hashtagsText = caption.hashtags && caption.hashtags.length > 0
      ? caption.hashtags.map(tag => tag.startsWith("#") ? tag : `#${tag}`).join(" ")
      : "";
    const hashtags = escapeCsvField(hashtagsText);

    rows.push(`${captionText},${platform},${goal},${hashtags}`);
  }

  return rows.join("\n");
}

