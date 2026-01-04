/**
 * Content Writer Import Helper
 * 
 * Builds entries array and fingerprints for AI Content Writer handoff imports.
 */

import { getHandoffHash } from "@/lib/utils/handoff-guard";
import type { ContentWriterHandoffPayload } from "@/lib/apps/ai-help-desk/handoff-parser";

export interface ImportEntry {
  title: string;
  body: string;
  fingerprint: string;
  type: "FAQ" | "NOTE";
}

const MAX_BODY_LENGTH = 12000; // 12k chars limit
const MAX_FAQ_ENTRIES = 25;

/**
 * Generate deterministic fingerprint for article
 */
function getArticleFingerprint(article: ContentWriterHandoffPayload["article"]): string {
  if (!article) return "";
  const firstSection = article.sections[0];
  const firstSectionHeading = firstSection?.heading || "";
  const firstSectionBody = firstSection?.body || "";
  const first200Chars = (firstSectionBody.substring(0, 200) || "").trim();
  const fingerprint = `${article.title}|${firstSectionHeading}|${first200Chars}`;
  return getHandoffHash(fingerprint);
}

/**
 * Generate deterministic fingerprint for FAQ
 */
function getFaqFingerprint(faq: { question: string; answer: string }): string {
  return getHandoffHash(`${faq.question}|${faq.answer}`);
}

/**
 * Trim body safely to max length, preserving word boundaries
 */
function trimBody(body: string, maxLength: number): string {
  if (body.length <= maxLength) return body;
  
  // Try to cut at a word boundary
  const trimmed = body.substring(0, maxLength);
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.9) {
    // If we found a space near the end, use it
    return trimmed.substring(0, lastSpace) + "...";
  }
  return trimmed + "...";
}

/**
 * Build article entry from Content Writer payload
 */
function buildArticleEntry(
  article: NonNullable<ContentWriterHandoffPayload["article"]>
): ImportEntry {
  // Build markdown content
  const parts: string[] = [];
  
  // H1 title
  const title = article.title || article.seoTitle || "Imported Article";
  parts.push(`# ${title}`);
  parts.push(""); // Empty line
  
  // Optional meta description
  if (article.metaDescription && article.metaDescription.trim()) {
    parts.push(`**Meta Description:** ${article.metaDescription}`);
    parts.push(""); // Empty line
  }
  
  // Sections as H2 + body
  for (const section of article.sections) {
    parts.push(`## ${section.heading}`);
    parts.push(""); // Empty line
    parts.push(section.body);
    parts.push(""); // Empty line
  }
  
  const body = trimBody(parts.join("\n"), MAX_BODY_LENGTH);
  const fingerprint = getArticleFingerprint(article);
  
  return {
    title: article.title || article.seoTitle || "Imported Article",
    body,
    fingerprint,
    type: "NOTE",
  };
}

/**
 * Build FAQ entry from Content Writer payload
 */
function buildFaqEntry(faq: { question: string; answer: string }): ImportEntry {
  const body = trimBody(faq.answer, MAX_BODY_LENGTH);
  const fingerprint = getFaqFingerprint(faq);
  
  return {
    title: faq.question,
    body,
    fingerprint,
    type: "FAQ",
  };
}

/**
 * Build entries array from Content Writer handoff payload
 * 
 * @param payload - The Content Writer handoff payload
 * @param importMode - What to import: "article", "faqs", or "both"
 * @returns Array of import entries
 */
export function buildContentWriterImportEntries(
  payload: ContentWriterHandoffPayload,
  importMode: "article" | "faqs" | "both"
): ImportEntry[] {
  const entries: ImportEntry[] = [];
  
  // Import article if selected
  if ((importMode === "article" || importMode === "both") && payload.article) {
    entries.push(buildArticleEntry(payload.article));
  }
  
  // Import FAQs if selected
  if ((importMode === "faqs" || importMode === "both") && payload.faqs && payload.faqs.length > 0) {
    // Enforce max 25 FAQs
    const faqsToImport = payload.faqs.slice(0, MAX_FAQ_ENTRIES);
    for (const faq of faqsToImport) {
      entries.push(buildFaqEntry(faq));
    }
  }
  
  return entries;
}

/**
 * Check if entry already exists by fingerprint
 */
export async function checkEntryExistsByFingerprint(
  businessId: string,
  fingerprint: string,
  type: "FAQ" | "NOTE"
): Promise<boolean> {
  try {
    // Search existing entries by type
    const res = await fetch(
      `/api/ai-help-desk/knowledge/list?businessId=${encodeURIComponent(businessId)}&type=${type}`
    );
    const json = await res.json();
    
    if (res.ok && json.ok && Array.isArray(json.data?.entries)) {
      // Check if any entry has matching fingerprint in tags
      return json.data.entries.some((entry: { tags?: string[] }) => 
        entry.tags?.includes(`fingerprint:${fingerprint}`)
      );
    }
    return false;
  } catch (error) {
    console.warn("Failed to check for existing entry:", error);
    return false;
  }
}

