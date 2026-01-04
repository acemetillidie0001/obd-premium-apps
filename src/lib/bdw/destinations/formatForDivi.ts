/**
 * Format content for Divi Builder
 * 
 * Output: clean semantic HTML (h1/h2/p/ul/li), no inline styles
 * Suitable for pasting into Divi text modules
 */

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
 * Format content for Divi Builder
 * 
 * Divi uses semantic HTML:
 * - h1 for main title
 * - h2 for section headings
 * - p for paragraphs
 * - ul/li for lists
 * - No inline styles (Divi handles styling)
 */
export function formatForDivi(input: DestinationInput): string {
  const parts: string[] = [];

  // Main Title (h1)
  if (input.title) {
    parts.push(`<h1>${escapeHtml(input.title)}</h1>`);
    parts.push("");
  }

  // Meta Description (as a paragraph, for reference)
  if (input.metaDescription) {
    parts.push(`<p class="meta-description">${escapeHtml(input.metaDescription)}</p>`);
    parts.push("");
  }

  // Description (if available as a single block)
  if (input.description) {
    // Split into paragraphs
    const paragraphs = input.description
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    
    paragraphs.forEach((para) => {
      parts.push(`<p>${escapeHtml(para)}</p>`);
    });
    parts.push("");
  }

  // Sections (h2 headings + paragraphs)
  if (input.sections && input.sections.length > 0) {
    input.sections.forEach((section) => {
      if (section.heading) {
        parts.push(`<h2>${escapeHtml(section.heading)}</h2>`);
      }
      
      // Split body into paragraphs
      const paragraphs = section.body
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      
      paragraphs.forEach((para) => {
        parts.push(`<p>${escapeHtml(para)}</p>`);
      });
      
      parts.push("");
    });
  }

  // Taglines (as unordered list)
  if (input.taglines && input.taglines.length > 0) {
    parts.push("<h2>Taglines</h2>");
    parts.push("<ul>");
    input.taglines.forEach((tagline) => {
      parts.push(`<li>${escapeHtml(tagline)}</li>`);
    });
    parts.push("</ul>");
    parts.push("");
  }

  // FAQs (as definition list or structured divs)
  if (input.faqs && input.faqs.length > 0) {
    parts.push("<h2>Frequently Asked Questions</h2>");
    input.faqs.forEach((faq) => {
      parts.push(`<h3>${escapeHtml(faq.q)}</h3>`);
      // Split answer into paragraphs
      const answerParagraphs = faq.a
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      
      answerParagraphs.forEach((para) => {
        parts.push(`<p>${escapeHtml(para)}</p>`);
      });
      parts.push("");
    });
  }

  return parts.join("\n").trim() || "<p>No content available for Divi export.</p>";
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

