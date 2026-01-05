/**
 * Handoff Builder for AI Image Caption Generator
 * 
 * Builds handoff payloads for sending captions to Social Auto-Poster
 */

import type { CaptionItem } from "@/app/apps/image-caption-generator/types";

/**
 * Handoff payload for Social Auto-Poster import
 */
export interface SocialAutoPosterHandoffPayload {
  type: "social_auto_poster_import";
  sourceApp: "ai-image-caption-generator";
  captions: Array<{
    platform: string;
    caption: string;
    hashtags?: string[];
    goal?: string | null;
  }>;
  meta: {
    sourceApp: "ai-image-caption-generator";
    createdAt: number;
  };
}

/**
 * Build handoff payload for Social Auto-Poster
 * 
 * @param captions - Array of captions to send
 * @returns Handoff payload ready for encoding
 */
export function buildSocialAutoPosterHandoff(
  captions: CaptionItem[]
): SocialAutoPosterHandoffPayload {
  return {
    type: "social_auto_poster_import",
    sourceApp: "ai-image-caption-generator",
    captions: captions.map((caption) => ({
      platform: caption.platform || "Generic",
      caption: caption.caption,
      hashtags: caption.hashtags && caption.hashtags.length > 0 
        ? caption.hashtags 
        : undefined,
      goal: caption.goal || null,
    })),
    meta: {
      sourceApp: "ai-image-caption-generator",
      createdAt: Date.now(),
    },
  };
}

/**
 * Encode handoff payload to base64url for URL parameter
 * 
 * @param payload - Handoff payload object
 * @returns Base64url-encoded string
 */
export function encodeHandoffPayload(payload: SocialAutoPosterHandoffPayload): string {
  const jsonString = JSON.stringify(payload);
  
  // Convert UTF-8 string to bytes, then to base64url
  const utf8Bytes = new TextEncoder().encode(jsonString);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  
  // Convert to base64url (replace + with -, / with _, remove padding)
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

