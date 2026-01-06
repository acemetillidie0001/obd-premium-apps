/**
 * Handoff Parser for Social Auto-Poster
 * 
 * Parses handoff payloads from AI Image Caption Generator and Offers Builder
 * 
 * Priority:
 * 1. Standardized sessionStorage transport (with TTL)
 * 2. Legacy URL/localStorage payloads (backward compatibility - migrates to sessionStorage)
 */

import { parseHandoffFromUrl } from "@/lib/utils/parse-handoff";
import { readHandoff, writeHandoff, clearHandoff } from "@/lib/obd-framework/social-handoff-transport";
import { clearHandoffParamsFromUrl, replaceUrlWithoutReload } from "@/lib/utils/clear-handoff-params";
import type { SocialPlatform } from "./types";

export interface SocialAutoPosterHandoffPayload {
  type: "social_auto_poster_import";
  sourceApp: "ai-image-caption-generator" | "offers-builder" | "event-campaign-builder";
  captions?: Array<{
    platform: string;
    caption: string;
    hashtags?: string[];
    goal?: string | null;
  }>;
  // Offers Builder specific fields
  campaignType?: "offer";
  headline?: string;
  description?: string;
  expirationDate?: string;
  suggestedCTA?: string;
  suggestedPlatforms?: string[];
  // Event Campaign Builder specific fields
  eventName?: string;
  eventDate?: string;
  location?: string;
  suggestedCountdownCopy?: string[];
  meta: {
    sourceApp: "ai-image-caption-generator" | "offers-builder" | "event-campaign-builder";
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

  // Check type
  if (p.type !== "social_auto_poster_import") {
    return false;
  }

  // Check sourceApp
  if (p.sourceApp !== "ai-image-caption-generator" && p.sourceApp !== "offers-builder" && p.sourceApp !== "event-campaign-builder") {
    return false;
  }

  // Check meta
  if (!p.meta || typeof p.meta !== "object") {
    return false;
  }
  const meta = p.meta as Record<string, unknown>;
  if (meta.sourceApp !== "ai-image-caption-generator" && meta.sourceApp !== "offers-builder" && meta.sourceApp !== "event-campaign-builder") {
    return false;
  }
  if (typeof meta.createdAt !== "number") {
    return false;
  }

  // For ai-image-caption-generator: require captions array
  if (p.sourceApp === "ai-image-caption-generator") {
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
  }

  // For offers-builder: require campaign fields
  if (p.sourceApp === "offers-builder") {
    if (p.campaignType !== "offer") {
      return false;
    }
    // headline and description are required for offers
    if (typeof p.headline !== "string" || p.headline.trim().length === 0) {
      return false;
    }
    if (typeof p.description !== "string" || p.description.trim().length === 0) {
      return false;
    }
    // Other fields are optional
    if (p.expirationDate !== undefined && typeof p.expirationDate !== "string") {
      return false;
    }
    if (p.suggestedCTA !== undefined && typeof p.suggestedCTA !== "string") {
      return false;
    }
    if (p.suggestedPlatforms !== undefined && (!Array.isArray(p.suggestedPlatforms) || !p.suggestedPlatforms.every(platform => typeof platform === "string"))) {
      return false;
    }
  }

  // For event-campaign-builder: require event fields
  if (p.sourceApp === "event-campaign-builder") {
    if (p.campaignType !== "event") {
      return false;
    }
    // eventName, eventDate, and description are required
    if (typeof p.eventName !== "string" || p.eventName.trim().length === 0) {
      return false;
    }
    if (typeof p.eventDate !== "string" || p.eventDate.trim().length === 0) {
      return false;
    }
    if (typeof p.description !== "string" || p.description.trim().length === 0) {
      return false;
    }
    // Other fields are optional
    if (p.location !== undefined && typeof p.location !== "string") {
      return false;
    }
    if (p.suggestedCountdownCopy !== undefined && (!Array.isArray(p.suggestedCountdownCopy) || !p.suggestedCountdownCopy.every(copy => typeof copy === "string"))) {
      return false;
    }
    if (p.suggestedPlatforms !== undefined && (!Array.isArray(p.suggestedPlatforms) || !p.suggestedPlatforms.every(platform => typeof platform === "string"))) {
      return false;
    }
  }

  return true;
}

/**
 * Parse handoff payload from standardized transport or legacy URL/localStorage
 * Returns null if no valid handoff is found
 * 
 * Priority:
 * 1. Standardized sessionStorage transport (with TTL)
 * 2. Legacy URL/localStorage payloads (backward compatibility - migrates to sessionStorage)
 */
export function parseSocialAutoPosterHandoff(
  searchParams: URLSearchParams
): SocialAutoPosterHandoffPayload | null {
  // Priority 1: Check standardized sessionStorage transport
  const handoffResult = readHandoff();
  
  if (handoffResult.envelope) {
    // Validate payload structure
    if (isValidSocialAutoPosterHandoff(handoffResult.envelope.payload)) {
      // Clear after reading (one-time use)
      clearHandoff();
      return handoffResult.envelope.payload as SocialAutoPosterHandoffPayload;
    } else {
      // Invalid payload - clear it
      clearHandoff();
      return null;
    }
  }
  
  if (handoffResult.expired) {
    // Expired - already cleared by readHandoff()
    return null;
  }
  
  if (handoffResult.error) {
    // Continue to legacy fallback for backward compatibility
  }

  // Priority 2: Check legacy URL/localStorage (backward compatibility)
  const legacyResult = parseHandoffFromUrl(searchParams, isValidSocialAutoPosterHandoff);
  
  if (legacyResult.payload !== null) {
    // Migrate legacy payload to sessionStorage
    const legacySource = legacyResult.payload.sourceApp || "unknown";
    writeHandoff(legacySource, legacyResult.payload);
    
    // Clear legacy storage and URL param
    if (typeof window !== "undefined") {
      const handoffId = searchParams.get("handoffId");
      if (handoffId) {
        try {
          localStorage.removeItem(`obd_handoff:${handoffId}`);
        } catch {
          // Ignore localStorage errors
        }
      }
      
      // Clear URL param
      const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
      replaceUrlWithoutReload(cleanUrl);
    }
    
    return legacyResult.payload;
  }

  // Only log errors for actual parsing/validation failures, not for missing handoff params
  if (legacyResult.error && legacyResult.error !== "No handoff parameter found in URL") {
    console.error("Failed to parse handoff payload:", legacyResult.error);
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

