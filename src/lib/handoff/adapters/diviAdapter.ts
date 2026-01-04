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
 * Convert WebDraftPayload to Divi-compatible HTML format
 */
export function webDraftToDivi(payload: WebDraftPayload): string {
  const parts: string[] = [];

  // Title as H1
  parts.push(`<h1>${escapeHtml(payload.content.title)}</h1>`);

  // Sections
  for (const section of payload.content.sections) {
    if (section.type === "heading") {
      // Headings → <h2>/<h3>/<h4>
      const level = Math.max(2, Math.min(4, section.level || 2));
      parts.push(`<h${level}>${escapeHtml(section.text || "")}</h${level}>`);
    } else if (section.type === "paragraph") {
      // Paragraph → <p>
      if (section.text?.trim()) {
        parts.push(`<p>${escapeHtml(section.text.trim())}</p>`);
      }
    } else if (section.type === "list") {
      // List → <ul><li>
      if (section.items && section.items.length > 0) {
        parts.push("<ul>");
        for (const item of section.items) {
          parts.push(`<li>${escapeHtml(item)}</li>`);
        }
        parts.push("</ul>");
      }
    }
  }

  // CTA → <h2>Call to Action</h2> + <p>
  if (payload.content.callToAction?.trim()) {
    parts.push("<h2>Call to Action</h2>");
    parts.push(`<p>${escapeHtml(payload.content.callToAction.trim())}</p>`);
  }

  return parts.join("\n");
}

/**
 * Divi CMS adapter metadata
 */
export const diviAdapter: CmsAdapter = {
  id: "divi",
  label: "Divi Builder",
  description: "HTML optimized for Divi modules",
  generate: webDraftToDivi,
};

