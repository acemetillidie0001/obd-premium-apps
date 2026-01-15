/**
 * Handoff Parser for Business Schema Generator
 *
 * Tenant-safety hardening:
 * - This app does NOT accept localStorage-backed `handoffId` payloads because localStorage
 *   persists across tenants/sessions and can leak cross-tenant data.
 * - Only `?handoff=<base64url-json>` query payloads are supported here.
 */

import { decodeBase64UrlToString, tryParseJson } from "@/lib/utils/parse-handoff";

type QueryOnlyParseResult<T> =
  | { payload: T; source: "query"; raw?: string }
  | { payload: null; error?: string };

function parseHandoffFromQueryOnly<T>(
  searchParams: URLSearchParams,
  validate: (p: unknown) => p is T
): QueryOnlyParseResult<T> {
  const handoff = searchParams.get("handoff");
  if (!handoff) {
    return { payload: null, error: "No handoff parameter found in URL" };
  }

  try {
    const decoded = decodeBase64UrlToString(handoff);
    const parsed = tryParseJson(decoded);
    if (parsed === null) {
      return { payload: null, error: "Failed to parse JSON from handoff query parameter" };
    }
    if (validate(parsed)) {
      return { payload: parsed, source: "query", raw: decoded };
    }
    return { payload: null, error: "Handoff payload failed validation" };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Failed to decode handoff query parameter",
    };
  }
}

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

export interface ContentWriterSchemaFaqHandoff {
  sourceApp: "ai-content-writer";
  targetApp: "business-schema-generator";
  createdAt: string;
  mode: "faq";
  faqs: Array<{ question: string; answer: string }>;
  businessContext?: {
    businessName?: string;
    businessType?: string;
    services?: string;
    city?: string;
    state?: string;
    topic?: string;
  };
}

export interface ContentWriterSchemaPageMetaHandoff {
  sourceApp: "ai-content-writer";
  targetApp: "business-schema-generator";
  createdAt: string;
  mode: "page-meta";
  pageMeta: {
    pageTitle?: string;
    pageDescription?: string;
    pageUrl?: string;
    pageType?: string;
  };
  businessContext?: {
    businessName?: string;
    businessType?: string;
    services?: string;
    city?: string;
    state?: string;
    topic?: string;
  };
}

export type ContentWriterSchemaHandoff =
  | ContentWriterSchemaFaqHandoff
  | ContentWriterSchemaPageMetaHandoff;

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
 * Type guard to validate ContentWriterSchemaHandoff
 */
function isValidContentWriterSchemaHandoff(
  payload: unknown
): payload is ContentWriterSchemaHandoff {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const p = payload as Record<string, unknown>;

  // Validate sourceApp
  if (p.sourceApp !== "ai-content-writer") {
    return false;
  }

  // Validate targetApp
  if (p.targetApp !== "business-schema-generator") {
    return false;
  }

  // Validate createdAt
  if (typeof p.createdAt !== "string" || p.createdAt.trim().length === 0) {
    return false;
  }

  // Validate mode
  if (p.mode !== "faq" && p.mode !== "page-meta") {
    return false;
  }

  // Validate businessContext (optional, but if present must be valid object)
  if (p.businessContext !== undefined) {
    if (!p.businessContext || typeof p.businessContext !== "object") {
      return false;
    }
    const bc = p.businessContext as Record<string, unknown>;
    // Validate all businessContext fields are optional strings if present
    const bcFields = ["businessName", "businessType", "services", "city", "state", "topic"];
    for (const field of bcFields) {
      if (bc[field] !== undefined && typeof bc[field] !== "string") {
        return false;
      }
    }
  }

  // Validate mode-specific requirements
  if (p.mode === "faq") {
    // Must have faqs array with length > 0
    if (!Array.isArray(p.faqs) || p.faqs.length === 0) {
      return false;
    }
    // Validate each FAQ has non-empty question and answer
    for (const faq of p.faqs) {
      if (!faq || typeof faq !== "object") {
        return false;
      }
      const faqObj = faq as Record<string, unknown>;
      if (
        typeof faqObj.question !== "string" ||
        faqObj.question.trim().length === 0
      ) {
        return false;
      }
      if (
        typeof faqObj.answer !== "string" ||
        faqObj.answer.trim().length === 0
      ) {
        return false;
      }
    }
  } else if (p.mode === "page-meta") {
    // Must have pageMeta object
    if (!p.pageMeta || typeof p.pageMeta !== "object") {
      return false;
    }
    const pageMeta = p.pageMeta as Record<string, unknown>;
    // At least one meaningful field must be present (non-empty string)
    const hasPageTitle = typeof pageMeta.pageTitle === "string" && pageMeta.pageTitle.trim().length > 0;
    const hasPageDescription = typeof pageMeta.pageDescription === "string" && pageMeta.pageDescription.trim().length > 0;
    const hasPageUrl = typeof pageMeta.pageUrl === "string" && pageMeta.pageUrl.trim().length > 0;
    
    if (!hasPageTitle && !hasPageDescription && !hasPageUrl) {
      return false;
    }
    
    // Validate pageType if present (should be string)
    if (pageMeta.pageType !== undefined && typeof pageMeta.pageType !== "string") {
      return false;
    }
  }

  // Size limit check: prevent oversized payloads (rough estimate: 100KB JSON)
  const jsonString = JSON.stringify(payload);
  if (jsonString.length > 100000) {
    console.warn("Content Writer Schema handoff payload too large, ignoring");
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
export function parseSchemaGeneratorHandoff(
  searchParams: URLSearchParams
): SchemaGeneratorHandoffPayload | null {
  const result = parseHandoffFromQueryOnly(searchParams, isValidSchemaGeneratorHandoff);

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
 * Parse Content Writer Schema Generator handoff payload from query param or localStorage
 * Returns null if no valid handoff is found
 * 
 * Uses the shared parseHandoffFromUrl utility while maintaining
 * the same validation rules and error handling behavior.
 */
export function parseContentWriterSchemaHandoff(
  searchParams: URLSearchParams
): ContentWriterSchemaHandoff | null {
  const result = parseHandoffFromQueryOnly(searchParams, isValidContentWriterSchemaHandoff);

  if (result.payload !== null) {
    return result.payload;
  }

  // Only log errors for actual parsing/validation failures, not for missing handoff params
  if (result.error && result.error !== "No handoff parameter found in URL") {
    console.error("Failed to parse Content Writer Schema handoff payload:", result.error);
  }

  return null;
}

