/**
 * Canonical Social Auto-Poster Handoff Parser
 * 
 * Reads and validates handoff payloads from standardized transport (sessionStorage with TTL)
 * or URL params (backward compatibility)
 */

import type { SocialComposerHandoffPayload } from "./socialHandoffTypes";
import { readHandoff, clearHandoff, writeHandoff } from "@/lib/obd-framework/social-handoff-transport";
import { decodeBase64UrlToString, tryParseJson } from "@/lib/utils/parse-handoff";

const MAX_TEXT_LENGTH = 5000; // Cap text fields to prevent abuse
const MAX_EVENT_NAME_LENGTH = 200;
const MAX_LOCATION_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_COUNTDOWN_VARIANT_LENGTH = 80;

export interface ParseResult {
  payload?: SocialComposerHandoffPayload;
  error?: string;
}

/**
 * Sanitize text field: trim and cap length
 */
function sanitizeText(text: string | undefined): string | undefined {
  if (!text || typeof text !== "string") {
    return undefined;
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.length > MAX_TEXT_LENGTH ? trimmed.substring(0, MAX_TEXT_LENGTH) : trimmed;
}

/**
 * Sanitize string with custom max length
 */
function sanitizeString(text: string | undefined, maxLength: number): string | undefined {
  if (!text || typeof text !== "string") {
    return undefined;
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) : trimmed;
}

/**
 * Validate payload structure
 */
function isValidPayload(payload: unknown): payload is SocialComposerHandoffPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const p = payload as Record<string, unknown>;

  // Must have v=1
  if (p.v !== 1) {
    return false;
  }

  // Must have valid source
  const validSources = [
    "ai-content-writer",
    "offers-builder",
    "event-campaign-builder",
    "image-caption-generator",
  ];
  if (typeof p.source !== "string" || !validSources.includes(p.source)) {
    return false;
  }

  // Source-specific validation: ai-content-writer
  if (p.source === "ai-content-writer") {
    // Required field: text must exist and be non-empty after trim
    if (typeof p.text !== "string" || p.text.trim().length === 0) {
      return false;
    }
  }

  // Source-specific validation: event-campaign-builder
  if (p.source === "event-campaign-builder") {
    // Required fields for event-campaign-builder
    if (typeof p.eventName !== "string" || p.eventName.trim().length === 0) {
      return false;
    }
    if (typeof p.eventDate !== "string") {
      return false;
    }
    if (typeof p.description !== "string") {
      return false; // Must exist, but can be empty
    }
    if (!Array.isArray(p.countdownVariants) || p.countdownVariants.length < 1) {
      return false;
    }
    if (!p.countdownVariants.every(v => typeof v === "string")) {
      return false;
    }
  }

  // Optional fields validation
  if (p.createdAt !== undefined && typeof p.createdAt !== "string") {
    return false;
  }
  if (p.text !== undefined && typeof p.text !== "string") {
    return false;
  }
  if (p.campaignType !== undefined && p.campaignType !== "offer" && p.campaignType !== "event") {
    return false;
  }
  if (p.headline !== undefined && typeof p.headline !== "string") {
    return false;
  }
  if (p.description !== undefined && typeof p.description !== "string") {
    return false;
  }
  if (p.cta !== undefined && typeof p.cta !== "string") {
    return false;
  }
  if (p.expirationDate !== undefined && typeof p.expirationDate !== "string") {
    return false;
  }
  if (p.eventName !== undefined && typeof p.eventName !== "string") {
    return false;
  }
  if (p.eventDate !== undefined && typeof p.eventDate !== "string") {
    return false;
  }
  if (p.location !== undefined && typeof p.location !== "string") {
    return false;
  }
  if (p.countdownVariants !== undefined) {
    if (!Array.isArray(p.countdownVariants) || !p.countdownVariants.every(v => typeof v === "string")) {
      return false;
    }
  }

  return true;
}


/**
 * Parse handoff payload from standardized transport or URL (backward compatibility)
 * 
 * Priority:
 * 1. Standardized sessionStorage transport (with TTL)
 * 2. URL search param with payload (backward compatibility - migrates to sessionStorage)
 * 
 * @param searchParams - URL search params
 * @returns ParseResult with payload or error
 */
export function parseSocialHandoff(searchParams: URLSearchParams | null): ParseResult {
  if (typeof window === "undefined") {
    return { error: "Not available in SSR" };
  }

  // Priority 1: Check standardized sessionStorage transport
  const handoffResult = readHandoff();
  
  if (handoffResult.envelope) {
    // Validate payload structure
    if (isValidPayload(handoffResult.envelope.payload)) {
      const rawPayload = handoffResult.envelope.payload as SocialComposerHandoffPayload;
      
      // Sanitize text fields with source-specific caps
      const sanitized: SocialComposerHandoffPayload = {
        ...rawPayload,
        text: rawPayload.source === "ai-content-writer"
          ? sanitizeText(rawPayload.text) || "" // ACW text is required, so ensure it exists
          : sanitizeText(rawPayload.text),
        headline: sanitizeText(rawPayload.headline),
        description: rawPayload.source === "event-campaign-builder" 
          ? sanitizeString(rawPayload.description, MAX_DESCRIPTION_LENGTH) || ""
          : sanitizeText(rawPayload.description),
        cta: sanitizeText(rawPayload.cta),
        eventName: rawPayload.source === "event-campaign-builder"
          ? sanitizeString(rawPayload.eventName, MAX_EVENT_NAME_LENGTH) || ""
          : sanitizeText(rawPayload.eventName),
        location: rawPayload.source === "event-campaign-builder"
          ? sanitizeString(rawPayload.location, MAX_LOCATION_LENGTH)
          : sanitizeText(rawPayload.location),
        countdownVariants: rawPayload.countdownVariants?.map(v => 
          rawPayload.source === "event-campaign-builder"
            ? sanitizeString(v, MAX_COUNTDOWN_VARIANT_LENGTH) || ""
            : sanitizeText(v) || ""
        ).filter((v): v is string => v !== undefined && v.length > 0),
      };
      
      // Clear after reading
      clearHandoff();
      
      return { payload: sanitized };
    } else {
      // Invalid payload - clear it
      clearHandoff();
      return { error: "Invalid payload structure in handoff envelope" };
    }
  }
  
  if (handoffResult.expired) {
    return { error: "expired" };
  }
  
  if (handoffResult.error) {
    // Continue to URL fallback for backward compatibility
  }

  // Priority 2: Check URL search param (backward compatibility)
  // If URL contains a payload (not just handoff=1), migrate it to sessionStorage
  if (searchParams) {
    const handoff = searchParams.get("handoff");
    if (handoff && handoff !== "1") {
      // This is a legacy URL payload - migrate to sessionStorage
      try {
        const decoded = decodeBase64UrlToString(handoff);
        const parsed = tryParseJson<SocialComposerHandoffPayload>(decoded);
        
        if (parsed && isValidPayload(parsed)) {
          // Migrate to sessionStorage
          writeHandoff(parsed.source || "unknown", parsed, 10 * 60 * 1000);
          
          // Sanitize text fields with source-specific caps
          const sanitized: SocialComposerHandoffPayload = {
            ...parsed,
            text: sanitizeText(parsed.text),
            headline: sanitizeText(parsed.headline),
            description: parsed.source === "event-campaign-builder"
              ? sanitizeString(parsed.description, MAX_DESCRIPTION_LENGTH) || ""
              : sanitizeText(parsed.description),
            cta: sanitizeText(parsed.cta),
            eventName: parsed.source === "event-campaign-builder"
              ? sanitizeString(parsed.eventName, MAX_EVENT_NAME_LENGTH) || ""
              : sanitizeText(parsed.eventName),
            location: parsed.source === "event-campaign-builder"
              ? sanitizeString(parsed.location, MAX_LOCATION_LENGTH)
              : sanitizeText(parsed.location),
            countdownVariants: parsed.countdownVariants?.map(v =>
              parsed.source === "event-campaign-builder"
                ? sanitizeString(v, MAX_COUNTDOWN_VARIANT_LENGTH) || ""
                : sanitizeText(v) || ""
            ).filter((v): v is string => v !== undefined && v.length > 0),
          };
          
          return { payload: sanitized };
        } else {
          return { error: "Invalid payload structure in URL" };
        }
      } catch (error) {
        return { error: "Failed to parse handoff payload from URL" };
      }
    }
  }

  // No handoff found
  return {};
}

