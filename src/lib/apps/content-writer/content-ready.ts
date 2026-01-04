/**
 * Content Writer - Export Readiness Validation
 * 
 * Central validation function to check if content is ready for export/copy operations.
 * Deterministic check based on content structure, not string matching.
 */

interface ContentSection {
  heading: string;
  body: string;
}

export interface ContentOutput {
  title: string;
  seoTitle: string;
  metaDescription: string;
  slugSuggestion: string;
  outline: string[];
  sections: ContentSection[];
  faq: Array<{ question: string; answer: string }>;
  socialBlurb: string;
  preview?: {
    cardTitle: string;
    cardSubtitle: string;
    cardExcerpt: string;
  };
  wordCountApprox: number;
  keywordsUsed: string[];
}

/**
 * Check if content is ready for export/copy operations.
 * 
 * Deterministic validation based on content structure:
 * - Has title (non-empty string)
 * - Has sections with body content
 * - Has meta description
 * - Has outline items
 * - Has SEO title
 * 
 * Returns true if any of these conditions are met.
 * Returns false for null, empty, or placeholder content.
 */
export function isContentReadyForExport(content: ContentOutput | null): boolean {
  if (!content) return false;
  
  // Check for meaningful content: title, sections with body, meta description, or outline
  const hasTitle = !!content.title?.trim();
  const hasSections = content.sections.length > 0 && content.sections.some(s => s.body?.trim());
  const hasMetaDescription = !!content.metaDescription?.trim();
  const hasOutline = content.outline.length > 0;
  const hasSEO = !!content.seoTitle?.trim();
  
  return hasTitle || hasSections || hasMetaDescription || hasOutline || hasSEO;
}

