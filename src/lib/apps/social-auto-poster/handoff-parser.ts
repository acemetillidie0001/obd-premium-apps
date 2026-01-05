/**
 * Handoff Parser for Social Auto-Poster
 * 
 * Parses handoff payloads from AI Image Caption Generator
 */

import { parseHandoffFromUrl } from "@/lib/utils/parse-handoff";
import type { SocialPlatform } from "./types";

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
 * Type guard to validate SocialAutoPosterHandoffPayload
 */
function isValidSocialAutoPosterHandoff(
  payload: unknown
): payload is SocialAutoPosterHandoffPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const p = payload as Record<string, unknown>;

  // Check type and sourceApp
  if (p.type !== "social_auto_poster_import" || p.sourceApp !== "ai-image-caption-generator") {
    return false;
  }

  // Check captions array
  if (!Array.isArray(p.captions) || p.captions.length === 0) {
    return false;
  }

  // Validate each caption
  for (const caption of p.captions) {
    if (typeof caption !== "object" || !caption) {
      return false;
    }
    const c = caption as Record<string, unknown>;
    
    // platform and caption are required
    if (typeof c.platform !== "string" || typeof c.caption !== "string" || c.caption.trim().length === 0) {
      return false;
    }
    
    // hashtags is optional but must be array if present
    if (c.hashtags !== undefined && (!Array.isArray(c.hashtags) || !c.hashtags.every(tag => typeof tag === "string"))) {
      return false;
    }
    
    // goal is optional
    if (c.goal !== undefined && c.goal !== null && typeof c.goal !== "string") {
      return false;
    }
  }

  // Check meta
  if (!p.meta || typeof p.meta !== "object") {
    return false;
  }
  const meta = p.meta as Record<string, unknown>;
  if (meta.sourceApp !== "ai-image-caption-generator" || typeof meta.createdAt !== "number") {
    return false;
  }

  return true;
}

/**
 * Parse handoff payload from query param or localStorage
 * Returns null if no valid handoff is found
 * 
 * Uses the shared parseHandoffFromUrl utility while maintaining
 * the same validation rules and error handling behavior.
 */
export function parseSocialAutoPosterHandoff(
  searchParams: URLSearchParams
): SocialAutoPosterHandoffPayload | null {
  const result = parseHandoffFromUrl(searchParams, isValidSocialAutoPosterHandoff);

  if (result.payload !== null) {
    return result.payload;
  }

  // Only log errors for actual parsing/validation failures, not for missing handoff params
  if (result.error && result.error !== "No handoff parameter found in URL") {
    console.error("Failed to parse handoff payload:", result.error);
  }

  return null;
}

/**
 * Normalize platform name from Image Caption Generator to Social Auto-Poster format
 */
export function normalizePlatform(platform: string): SocialPlatform | null {
  const normalized = platform.toLowerCase().trim();
  
  // Map Image Caption Generator platforms to Social Auto-Poster platforms
  if (normalized === "facebook") return "facebook";
  if (normalized === "instagram" || normalized === "instagramstory") return "instagram";
  if (normalized === "x" || normalized === "twitter") return "x";
  if (normalized === "googlebusiness" || normalized === "googlebusinessprofile") return "googleBusiness";
  
  return null;
}

