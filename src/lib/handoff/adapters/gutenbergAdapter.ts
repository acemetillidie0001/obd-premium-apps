import type { WebDraftPayload } from "../types";
import type { CmsAdapter } from "./types";

/**
 * Escape HTML special characters to prevent injection
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

/**
 * Convert WebDraftPayload to WordPress Gutenberg block format
 */
export function webDraftToGutenberg(payload: WebDraftPayload): string {
  const blocks: string[] = [];

  // Title as wp:heading level 1
  blocks.push("<!-- wp:heading {\"level\":1} -->");
  blocks.push(`<h1>${escapeHtml(payload.content.title)}</h1>`);
  blocks.push("<!-- /wp:heading -->");

  // Sections
  for (const section of payload.content.sections) {
    if (section.type === "heading") {
      // Headings map to wp:heading with correct level (2-4)
      const level = Math.max(2, Math.min(4, section.level || 2));
      blocks.push(`<!-- wp:heading {"level":${level}} -->`);
      blocks.push(`<h${level}>${escapeHtml(section.text || "")}</h${level}>`);
      blocks.push("<!-- /wp:heading -->");
    } else if (section.type === "paragraph") {
      // Paragraph → wp:paragraph
      if (section.text?.trim()) {
        blocks.push("<!-- wp:paragraph -->");
        blocks.push(`<p>${escapeHtml(section.text.trim())}</p>`);
        blocks.push("<!-- /wp:paragraph -->");
      }
    } else if (section.type === "list") {
      // List → wp:list with <ul><li>
      if (section.items && section.items.length > 0) {
        blocks.push("<!-- wp:list -->");
        blocks.push("<ul>");
        for (const item of section.items) {
          blocks.push(`<li>${escapeHtml(item)}</li>`);
        }
        blocks.push("</ul>");
        blocks.push("<!-- /wp:list -->");
      }
    }
  }

  // CTA → wp:paragraph under heading "Call to Action"
  if (payload.content.callToAction?.trim()) {
    // First add the heading
    blocks.push("<!-- wp:heading {\"level\":2} -->");
    blocks.push("<h2>Call to Action</h2>");
    blocks.push("<!-- /wp:heading -->");
    // Then the paragraph
    blocks.push("<!-- wp:paragraph -->");
    blocks.push(`<p>${escapeHtml(payload.content.callToAction.trim())}</p>`);
    blocks.push("<!-- /wp:paragraph -->");
  }

  return blocks.join("\n");
}

/**
 * Gutenberg CMS adapter metadata
 */
export const gutenbergAdapter: CmsAdapter = {
  id: "gutenberg",
  label: "WordPress (Gutenberg)",
  description: "Paste-ready WordPress block markup",
  generate: webDraftToGutenberg,
};

