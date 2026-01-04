/**
 * Handoff Parser for Business Schema Generator
 * 
 * Parses handoff payloads from query params or localStorage
 */

import { parseHandoffFromUrl } from "@/lib/utils/parse-handoff";

export interface SchemaGeneratorHandoffPayload {
  sourceApp: "ai-faq-generator";
  type: "faqpage-jsonld";
  title: string;
  jsonLd: string;
  context: {
    businessName: string;
    businessType: string;
    topic: string;
  };
}

/**
 * Type guard to validate SchemaGeneratorHandoffPayload
 */
function isValidSchemaGeneratorHandoff(
  payload: unknown
): payload is SchemaGeneratorHandoffPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const p = payload as Record<string, unknown>;

  return (
    p.sourceApp === "ai-faq-generator" &&
    p.type === "faqpage-jsonld" &&
    typeof p.jsonLd === "string" &&
    p.jsonLd.length > 0
  );
}

/**
 * Parse handoff payload from query param or localStorage
 * Returns null if no valid handoff is found
 * 
 * Uses the shared parseHandoffFromUrl utility while maintaining
 * the same validation rules and error handling behavior.
 */
export function parseSchemaGeneratorHandoff(
  searchParams: URLSearchParams
): SchemaGeneratorHandoffPayload | null {
  const result = parseHandoffFromUrl(searchParams, isValidSchemaGeneratorHandoff);

  if (result.payload !== null) {
    return result.payload;
  }

  // Log error for debugging (matches previous behavior)
  if (result.error) {
    console.error("Failed to parse handoff payload:", result.error);
  }

  return null;
}

