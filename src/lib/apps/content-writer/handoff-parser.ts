/**
 * Handoff Parser for AI Content Writer
 * 
 * Parses handoff payloads from query params or localStorage
 */

import { parseHandoffFromUrl } from "@/lib/utils/parse-handoff";

export interface ContentWriterHandoffPayload {
  sourceApp: "ai-faq-generator";
  type: "faq-section";
  title: string;
  markdown: string;
  html: string;
  divi: string;
  context: {
    businessName: string;
    businessType: string;
    topic: string;
    services: string;
  };
}

/**
 * Type guard to validate ContentWriterHandoffPayload
 */
function isValidContentWriterHandoff(
  payload: unknown
): payload is ContentWriterHandoffPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const p = payload as Record<string, unknown>;

  return (
    p.sourceApp === "ai-faq-generator" &&
    p.type === "faq-section" &&
    typeof p.markdown === "string" &&
    p.markdown.length > 0
  );
}

/**
 * Parse handoff payload from query param or localStorage
 * Returns null if no valid handoff is found
 * 
 * Uses the shared parseHandoffFromUrl utility while maintaining
 * the same validation rules and error handling behavior.
 */
export function parseContentWriterHandoff(
  searchParams: URLSearchParams
): ContentWriterHandoffPayload | null {
  const result = parseHandoffFromUrl(searchParams, isValidContentWriterHandoff);

  if (result.payload !== null) {
    return result.payload;
  }

  // Log error for debugging (matches previous behavior)
  if (result.error) {
    console.error("Failed to parse handoff payload:", result.error);
  }

  return null;
}

