/**
 * Web Draft Serializers
 * 
 * Convert WebDraftPayload to various output formats (Markdown, HTML).
 */

import type { WebDraftPayload } from "../types";

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
 * Serialize WebDraftPayload to Markdown format
 */
export function webDraftToMarkdown(payload: WebDraftPayload): string {
  const parts: string[] = [];

  // H1: title
  parts.push(`# ${payload.content.title}`);

  // Excerpt (if exists)
  if (payload.content.excerpt?.trim()) {
    parts.push("");
    parts.push(`*${payload.content.excerpt.trim()}*`);
  }

  // Sections
  for (const section of payload.content.sections) {
    parts.push("");

    if (section.type === "heading") {
      // Use ## / ### / #### based on level (2-4)
      const level = section.level || 2;
      const hashes = "#".repeat(Math.max(2, Math.min(4, level)));
      parts.push(`${hashes} ${section.text || ""}`);
    } else if (section.type === "paragraph") {
      // Plain paragraph
      parts.push(section.text || "");
    } else if (section.type === "list") {
      // List: "- item" per line
      if (section.items && section.items.length > 0) {
        for (const item of section.items) {
          parts.push(`- ${item}`);
        }
      }
    }
  }

  // Call to Action (if exists)
  if (payload.content.callToAction?.trim()) {
    parts.push("");
    parts.push("## Call to Action");
    parts.push("");
    parts.push(payload.content.callToAction.trim());
  }

  // Meta section (if exists)
  if (payload.meta) {
    const metaParts: string[] = [];
    let hasMetaContent = false;

    if (payload.meta.seoTitle?.trim()) {
      metaParts.push(`SEO Title: ${payload.meta.seoTitle.trim()}`);
      hasMetaContent = true;
    }

    if (payload.meta.seoDescription?.trim()) {
      metaParts.push(`SEO Description: ${payload.meta.seoDescription.trim()}`);
      hasMetaContent = true;
    }

    if (payload.meta.canonicalUrl?.trim()) {
      metaParts.push(`Canonical URL: ${payload.meta.canonicalUrl.trim()}`);
      hasMetaContent = true;
    }

    if (hasMetaContent) {
      parts.push("");
      parts.push("## Meta");
      for (const metaPart of metaParts) {
        parts.push(metaPart);
      }
    }
  }

  return parts.join("\n");
}

/**
 * Serialize WebDraftPayload to HTML format
 */
export function webDraftToHtml(payload: WebDraftPayload): string {
  const parts: string[] = [];

  // Title (H1)
  parts.push(`<h1>${escapeHtml(payload.content.title)}</h1>`);

  // Excerpt (if exists)
  if (payload.content.excerpt?.trim()) {
    parts.push(`<p><em>${escapeHtml(payload.content.excerpt.trim())}</em></p>`);
  }

  // Sections
  for (const section of payload.content.sections) {
    if (section.type === "heading") {
      // Use h2/h3/h4 based on level (2-4)
      const level = Math.max(2, Math.min(4, section.level || 2));
      const tag = `h${level}`;
      parts.push(`<${tag}>${escapeHtml(section.text || "")}</${tag}>`);
    } else if (section.type === "paragraph") {
      // Paragraph
      if (section.text?.trim()) {
        parts.push(`<p>${escapeHtml(section.text.trim())}</p>`);
      }
    } else if (section.type === "list") {
      // List
      if (section.items && section.items.length > 0) {
        parts.push("<ul>");
        for (const item of section.items) {
          parts.push(`<li>${escapeHtml(item)}</li>`);
        }
        parts.push("</ul>");
      }
    }
  }

  // Call to Action (if exists)
  if (payload.content.callToAction?.trim()) {
    parts.push('<section>');
    parts.push("<h2>Call to Action</h2>");
    parts.push(`<p>${escapeHtml(payload.content.callToAction.trim())}</p>`);
    parts.push('</section>');
  }

  // Meta section (if exists)
  if (payload.meta) {
    const metaParts: string[] = [];
    let hasMetaContent = false;

    if (payload.meta.seoTitle?.trim()) {
      metaParts.push(`<p>SEO Title: ${escapeHtml(payload.meta.seoTitle.trim())}</p>`);
      hasMetaContent = true;
    }

    if (payload.meta.seoDescription?.trim()) {
      metaParts.push(`<p>SEO Description: ${escapeHtml(payload.meta.seoDescription.trim())}</p>`);
      hasMetaContent = true;
    }

    if (payload.meta.canonicalUrl?.trim()) {
      metaParts.push(`<p>Canonical URL: ${escapeHtml(payload.meta.canonicalUrl.trim())}</p>`);
      hasMetaContent = true;
    }

    if (hasMetaContent) {
      parts.push('<section>');
      parts.push("<h2>Meta</h2>");
      parts.push(...metaParts);
      parts.push('</section>');
    }
  }

  return parts.join("\n");
}

