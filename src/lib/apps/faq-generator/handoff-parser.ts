/**
 * Handoff Parser for AI FAQ Generator
 * 
 * Parses handoff payloads from query params or localStorage
 */

import { parseHandoffFromUrl } from "@/lib/utils/parse-handoff";

export interface HelpDeskHandoffPayload {
  sourceApp: "ai-help-desk";
  importedAt: string;
  questions: string[];
  context?: {
    businessId?: string;
    topic?: string;
  };
}

/**
 * Type guard to validate HelpDeskHandoffPayload
 */
function isValidHelpDeskHandoff(
  payload: unknown
): payload is HelpDeskHandoffPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const p = payload as Record<string, unknown>;

  // Validate sourceApp
  if (p.sourceApp !== "ai-help-desk") {
    return false;
  }

  // Validate questions is a non-empty array
  if (!Array.isArray(p.questions) || p.questions.length === 0) {
    return false;
  }

  // Validate every question is a non-empty string (trimmed)
  for (const question of p.questions) {
    if (typeof question !== "string" || question.trim().length === 0) {
      return false;
    }
  }

  // Validate context if present
  if (p.context !== undefined) {
    if (!p.context || typeof p.context !== "object") {
      return false;
    }
    const ctx = p.context as Record<string, unknown>;
    if (ctx.businessId !== undefined && typeof ctx.businessId !== "string") {
      return false;
    }
    if (ctx.topic !== undefined && typeof ctx.topic !== "string") {
      return false;
    }
  }

  // Size limit check: prevent oversized payloads (rough estimate: 100KB JSON)
  const jsonString = JSON.stringify(payload);
  if (jsonString.length > 100000) {
    console.warn("Handoff payload too large, ignoring");
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
export function parseHelpDeskHandoffPayload(
  searchParams: URLSearchParams
): HelpDeskHandoffPayload | null {
  const result = parseHandoffFromUrl(searchParams, isValidHelpDeskHandoff);

  if (result.payload !== null) {
    return result.payload;
  }

  // Only log errors for actual parsing/validation failures, not for missing handoff params
  if (result.error && result.error !== "No handoff parameter found in URL") {
    console.error("Failed to parse handoff payload:", result.error);
  }

  return null;
}

