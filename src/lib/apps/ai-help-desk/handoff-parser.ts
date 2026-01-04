/**
 * Handoff Parser for AI Help Desk
 * 
 * Parses handoff payloads from query params or localStorage
 */

import { parseHandoffFromUrl } from "@/lib/utils/parse-handoff";

export interface HelpDeskHandoffPayload {
  sourceApp: "ai-faq-generator";
  importedAt: string;
  mode: "qa" | "doc";
  title: string;
  items: Array<{ question: string; answer: string }>;
  businessContext: {
    businessName: string;
    businessType: string;
    topic: string;
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
  if (p.sourceApp !== "ai-faq-generator") {
    return false;
  }

  // Validate mode is exactly "qa" or "doc"
  if (p.mode !== "qa" && p.mode !== "doc") {
    return false;
  }

  // Validate items is a non-empty array
  if (!Array.isArray(p.items) || p.items.length === 0) {
    return false;
  }

  // Validate every item has non-empty question and answer (trimmed)
  for (const item of p.items) {
    if (!item || typeof item !== "object") {
      return false;
    }

    const itemObj = item as Record<string, unknown>;

    // Check question is a non-empty string (trimmed)
    if (
      typeof itemObj.question !== "string" ||
      itemObj.question.trim().length === 0
    ) {
      return false;
    }

    // Check answer is a non-empty string (trimmed)
    if (
      typeof itemObj.answer !== "string" ||
      itemObj.answer.trim().length === 0
    ) {
      return false;
    }
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
export function parseHandoffPayload(
  searchParams: URLSearchParams
): HelpDeskHandoffPayload | null {
  const result = parseHandoffFromUrl(searchParams, isValidHelpDeskHandoff);

  if (result.payload !== null) {
    return result.payload;
  }

  // Log error for debugging (matches previous behavior)
  if (result.error) {
    console.error("Failed to parse handoff payload:", result.error);
  }

  return null;
}

