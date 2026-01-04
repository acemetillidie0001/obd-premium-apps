/**
 * Web Draft Builder for Content Writer
 * 
 * Converts ContentOutput to WebDraftPayload for handoff export.
 */

import type { WebDraftPayload, WebDraftSection } from "@/lib/handoff/types";
import type { ContentOutput } from "@/lib/apps/content-writer/content-ready";

/**
 * Derive excerpt from content
 * Uses metaDescription if present, otherwise first paragraph trimmed to ~160 chars
 */
function deriveExcerpt(content: ContentOutput): string | undefined {
  if (content.metaDescription?.trim()) {
    return content.metaDescription.trim();
  }

  // Find first paragraph from sections
  for (const section of content.sections) {
    if (section.body?.trim()) {
      const firstParagraph = section.body.split(/\n\n/)[0]?.trim();
      if (firstParagraph) {
        // Trim to ~160 chars, but try to end at a sentence boundary
        if (firstParagraph.length <= 160) {
          return firstParagraph;
        }
        // Find last sentence boundary before 160 chars
        const truncated = firstParagraph.substring(0, 160);
        const lastPeriod = truncated.lastIndexOf(".");
        const lastExclamation = truncated.lastIndexOf("!");
        const lastQuestion = truncated.lastIndexOf("?");
        const lastBoundary = Math.max(lastPeriod, lastExclamation, lastQuestion);
        if (lastBoundary > 100) {
          return truncated.substring(0, lastBoundary + 1);
        }
        // Fallback: trim at word boundary
        const lastSpace = truncated.lastIndexOf(" ");
        if (lastSpace > 100) {
          return truncated.substring(0, lastSpace) + "...";
        }
        return truncated + "...";
      }
    }
  }

  return undefined;
}

/**
 * Parse body text into sections (Priority 2: plain text derivation)
 * 
 * Rules:
 * - Split by blank lines
 * - Lines beginning with "## " => heading level 2
 * - "### " => level 3
 * - "#### " => level 4
 * - Blocks where most lines start with "-" or "•" => list items
 * - Else => paragraph
 */
function parseBodyIntoSections(body: string): WebDraftSection[] {
  const sections: WebDraftSection[] = [];
  const blocks = body.split(/\n\s*\n/).filter((block) => block.trim());

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split(/\n/).filter((line) => line.trim());

    // Check for heading (## / ### / ####)
    const firstLine = lines[0]?.trim();
    if (firstLine) {
      const headingMatch = firstLine.match(/^(#{2,4})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length; // 2, 3, or 4
        const text = headingMatch[2].trim();
        if (text && level >= 2 && level <= 4) {
          sections.push({
            type: "heading",
            level: level as 2 | 3 | 4,
            text,
          });
          continue;
        }
      }
    }

    // Check for list: most lines start with "-" or "•"
    const bulletLines = lines.filter((line) => {
      const trimmedLine = line.trim();
      return trimmedLine.startsWith("- ") || trimmedLine.startsWith("• ");
    });

    // If most lines (>= 50%) are bullet points, treat as list
    if (lines.length > 0 && bulletLines.length >= Math.ceil(lines.length / 2)) {
      const items = bulletLines
        .map((line) => {
          const trimmedLine = line.trim();
          // Remove bullet markers
          return trimmedLine.replace(/^[-•]\s+/, "").trim();
        })
        .filter((item) => item.length > 0);

      if (items.length > 0 && items.length <= 50) {
        sections.push({
          type: "list",
          items,
        });
        continue;
      }
    }

    // Default to paragraph
    const text = trimmed.replace(/^#{1,6}\s+/gm, "").trim(); // Remove any markdown heading markers
    if (text) {
      sections.push({
        type: "paragraph",
        text,
      });
    }
  }

  return sections;
}

/**
 * Map ContentOutput sections to WebDraftSection[]
 * 
 * If ACW already has structured sections, map them directly.
 * Otherwise, derive sections from the main body.
 */
function mapSections(content: ContentOutput): WebDraftSection[] {
  const sections: WebDraftSection[] = [];

  // If we have structured sections, use them
  if (content.sections && content.sections.length > 0) {
    for (const section of content.sections) {
      // Add heading if present
      if (section.heading?.trim()) {
        sections.push({
          type: "heading",
          level: 2, // Default to level 2 for section headings
          text: section.heading.trim(),
        });
      }

      // Parse body into sections (paragraphs/lists)
      if (section.body?.trim()) {
        const bodySections = parseBodyIntoSections(section.body);
        sections.push(...bodySections);
      }
    }
  }
  // Note: If content.sections is empty, sections will be empty and we'll add a fallback in buildWebDraftPayload

  // Ensure we never exceed 200 sections; truncate and add final paragraph
  const MAX_SECTIONS = 200;
  if (sections.length > MAX_SECTIONS) {
    const truncated = sections.slice(0, MAX_SECTIONS - 1);
    truncated.push({
      type: "paragraph",
      text: "…(truncated for export)",
    });
    return truncated;
  }

  return sections;
}

/**
 * Build WebDraftPayload from ContentOutput
 */
export function buildWebDraftPayload(content: ContentOutput): WebDraftPayload {
  const sections = mapSections(content);

  // Ensure we have at least one section
  if (sections.length === 0) {
    sections.push({
      type: "paragraph",
      text: content.title || "Website Draft",
    });
  }

  const payload: WebDraftPayload = {
    mode: "web-draft",
    source: "ai-content-writer",
    version: "1.0",
    content: {
      title: content.title?.trim() || "Website Draft",
      slug: content.slugSuggestion?.trim() || undefined,
      excerpt: deriveExcerpt(content),
      sections,
    },
  };

  // Add meta if SEO fields are present
  if (content.seoTitle?.trim() || content.metaDescription?.trim()) {
    payload.meta = {
      seoTitle: content.seoTitle?.trim() || undefined,
      seoDescription: content.metaDescription?.trim() || undefined,
    };
  }

  return payload;
}

