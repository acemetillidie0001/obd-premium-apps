/**
 * Format content for Google Business Profile (GBP)
 * 
 * Output: field-labeled, clean line breaks, length-aware
 * Uses safeTrimToLimit for character limits
 */

import { safeTrimToLimit } from "@/lib/utils/safeTrimToLimit";

export interface DestinationInput {
  title?: string;
  slug?: string;
  metaDescription?: string;
  description?: string;
  sections?: Array<{ heading?: string; body: string }>;
  taglines?: string[];
  faqs?: Array<{ q: string; a: string }>;
  platforms?: Record<string, string[]>;
}

/**
 * Format content for Google Business Profile
 * 
 * GBP has specific field requirements:
 * - Business Description: 750 characters max
 * - Clean, helpful, informative
 * - Field-labeled output for easy copy-paste
 */
export function formatForGBP(input: DestinationInput): string {
  const parts: string[] = [];

  // Business Description (primary field)
  if (input.description) {
    const gbpDescription = safeTrimToLimit(input.description, 750);
    parts.push("Business Description:");
    parts.push(gbpDescription);
    parts.push("");
  }

  // If no description, try to build from sections
  if (!input.description && input.sections && input.sections.length > 0) {
    const combinedSections = input.sections
      .map((s) => {
        if (s.heading) {
          return `${s.heading}\n\n${s.body}`;
        }
        return s.body;
      })
      .join("\n\n");
    
    const gbpDescription = safeTrimToLimit(combinedSections, 750);
    parts.push("Business Description:");
    parts.push(gbpDescription);
    parts.push("");
  }

  // Meta Description (if available, for reference)
  if (input.metaDescription) {
    const meta = safeTrimToLimit(input.metaDescription, 160);
    parts.push("Meta Description (for reference):");
    parts.push(meta);
    parts.push("");
  }

  // Taglines (short, punchy options)
  if (input.taglines && input.taglines.length > 0) {
    parts.push("Tagline Options:");
    input.taglines.forEach((tagline, idx) => {
      const trimmed = safeTrimToLimit(tagline, 100);
      parts.push(`${idx + 1}. ${trimmed}`);
    });
    parts.push("");
  }

  // FAQs (if available, formatted for GBP Q&A section)
  if (input.faqs && input.faqs.length > 0) {
    parts.push("FAQ Suggestions (for GBP Q&A):");
    input.faqs.forEach((faq, idx) => {
      const q = safeTrimToLimit(faq.q, 200);
      const a = safeTrimToLimit(faq.a, 500);
      parts.push(`Q${idx + 1}: ${q}`);
      parts.push(`A${idx + 1}: ${a}`);
      parts.push("");
    });
  }

  return parts.join("\n").trim() || "No content available for GBP export.";
}

