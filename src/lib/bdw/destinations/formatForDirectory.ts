/**
 * Format content for Directory listings
 * 
 * Output: short + long variants with clear labels
 * Suitable for directory platforms that need structured content
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
 * Format content for Directory listings
 * 
 * Directories typically need:
 * - Short description (brief, scannable)
 * - Long description (detailed, comprehensive)
 * - Clear labels for easy copy-paste
 */
export function formatForDirectory(input: DestinationInput): string {
  const parts: string[] = [];

  // Title
  if (input.title) {
    parts.push("Title:");
    parts.push(input.title);
    parts.push("");
  }

  // Slug (if available)
  if (input.slug) {
    parts.push("Slug:");
    parts.push(input.slug);
    parts.push("");
  }

  // Short Description (brief, scannable)
  let shortDescription = "";
  if (input.description) {
    // Use first paragraph or first ~200 chars
    const firstParagraph = input.description.split(/\n\s*\n/)[0]?.trim() || "";
    shortDescription = firstParagraph.length > 200 
      ? firstParagraph.substring(0, 200).trim() + "..."
      : firstParagraph;
  } else if (input.sections && input.sections.length > 0) {
    // Use first section body
    const firstSection = input.sections[0];
    if (firstSection.body) {
      const firstPara = firstSection.body.split(/\n\s*\n/)[0]?.trim() || "";
      shortDescription = firstPara.length > 200
        ? firstPara.substring(0, 200).trim() + "..."
        : firstPara;
    }
  }

  if (shortDescription) {
    parts.push("Short Description:");
    parts.push(shortDescription);
    parts.push("");
  }

  // Long Description (comprehensive)
  let longDescription = "";
  if (input.description) {
    longDescription = input.description;
  } else if (input.sections && input.sections.length > 0) {
    longDescription = input.sections
      .map((s) => {
        if (s.heading) {
          return `${s.heading}\n\n${s.body}`;
        }
        return s.body;
      })
      .join("\n\n");
  }

  if (longDescription) {
    parts.push("Long Description:");
    parts.push(longDescription);
    parts.push("");
  }

  // Meta Description
  if (input.metaDescription) {
    parts.push("Meta Description:");
    parts.push(input.metaDescription);
    parts.push("");
  }

  // Taglines
  if (input.taglines && input.taglines.length > 0) {
    parts.push("Taglines:");
    input.taglines.forEach((tagline, idx) => {
      parts.push(`${idx + 1}. ${tagline}`);
    });
    parts.push("");
  }

  // FAQs
  if (input.faqs && input.faqs.length > 0) {
    parts.push("Frequently Asked Questions:");
    input.faqs.forEach((faq, idx) => {
      parts.push(`Q${idx + 1}: ${faq.q}`);
      parts.push(`A${idx + 1}: ${faq.a}`);
      parts.push("");
    });
  }

  return parts.join("\n").trim() || "No content available for Directory export.";
}

