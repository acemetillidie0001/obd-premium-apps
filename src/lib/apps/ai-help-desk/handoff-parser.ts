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

export interface ContentWriterHandoffPayload {
  sourceApp: "ai-content-writer";
  createdAt: string;
  mode: "faq-only" | "content";
  article?: {
    title: string;
    seoTitle: string;
    metaDescription: string;
    slugSuggestion: string;
    sections: Array<{ heading: string; body: string }>;
  };
  faqs?: Array<{ question: string; answer: string }>;
  keywordsUsed?: string[];
  businessContext?: {
    businessName?: string;
    businessType?: string;
    topic?: string;
    services?: string;
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
 * Type guard to validate ContentWriterHandoffPayload
 */
function isValidContentWriterHandoff(
  payload: unknown
): payload is ContentWriterHandoffPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const p = payload as Record<string, unknown>;

  // Validate sourceApp
  if (p.sourceApp !== "ai-content-writer") {
    return false;
  }

  // Validate mode
  if (p.mode !== "faq-only" && p.mode !== "content") {
    return false;
  }

  // Validate createdAt
  if (typeof p.createdAt !== "string" || p.createdAt.trim().length === 0) {
    return false;
  }

  // Validate businessContext (optional, but if present must be valid object)
  if (p.businessContext !== undefined) {
    if (!p.businessContext || typeof p.businessContext !== "object") {
      return false;
    }
    const bc = p.businessContext as Record<string, unknown>;
    // If businessContext is provided, validate its structure
    if (bc.businessName !== undefined && typeof bc.businessName !== "string") {
      return false;
    }
    if (bc.businessType !== undefined && typeof bc.businessType !== "string") {
      return false;
    }
    if (bc.topic !== undefined && typeof bc.topic !== "string") {
      return false;
    }
  }

  // Validate mode-specific requirements
  if (p.mode === "faq-only") {
    // Must have FAQs
    if (!Array.isArray(p.faqs) || p.faqs.length === 0) {
      return false;
    }
    // Validate each FAQ
    for (const faq of p.faqs) {
      if (!faq || typeof faq !== "object") {
        return false;
      }
      const faqObj = faq as Record<string, unknown>;
      if (typeof faqObj.question !== "string" || faqObj.question.trim().length === 0) {
        return false;
      }
      if (typeof faqObj.answer !== "string" || faqObj.answer.trim().length === 0) {
        return false;
      }
    }
  } else if (p.mode === "content") {
    // Must have article
    if (!p.article || typeof p.article !== "object") {
      return false;
    }
    const article = p.article as Record<string, unknown>;
    if (typeof article.title !== "string" || article.title.trim().length === 0) {
      return false;
    }
    if (!Array.isArray(article.sections) || article.sections.length === 0) {
      return false;
    }
    // Validate each section
    for (const section of article.sections) {
      if (!section || typeof section !== "object") {
        return false;
      }
      const sectionObj = section as Record<string, unknown>;
      if (typeof sectionObj.heading !== "string" || typeof sectionObj.body !== "string") {
        return false;
      }
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
export function parseHandoffPayload(
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

/**
 * Parse Content Writer handoff payload from query param or localStorage
 * Returns null if no valid handoff is found
 */
export function parseContentWriterHandoffPayload(
  searchParams: URLSearchParams
): ContentWriterHandoffPayload | null {
  const result = parseHandoffFromUrl(searchParams, isValidContentWriterHandoff);

  if (result.payload !== null) {
    return result.payload;
  }

  // Only log errors for actual parsing/validation failures, not for missing handoff params
  if (result.error && result.error !== "No handoff parameter found in URL") {
    console.error("Failed to parse Content Writer handoff payload:", result.error);
  }

  return null;
}

