/**
 * FAQ Export Formatters
 * Formats FAQ items for various export destinations
 */

export interface FAQItem {
  number: number;
  question: string;
  answer: string;
  characterCount: number;
}

// Escape HTML special characters
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m] ?? m);
}

/**
 * Format FAQs as plain text
 */
export function formatFAQsPlainText(faqs: FAQItem[]): string {
  return faqs.map((faq) => `FAQ ${faq.number}\nQ: ${faq.question}\nA: ${faq.answer}`).join("\n\n");
}

/**
 * Format FAQs as Markdown
 */
export function formatFAQsMarkdown(faqs: FAQItem[]): string {
  const parts: string[] = [];
  parts.push("## Frequently Asked Questions\n");
  faqs.forEach((faq) => {
    parts.push(`### ${faq.question}\n`);
    parts.push(`${faq.answer}\n`);
  });
  return parts.join("\n");
}

/**
 * Format FAQs as HTML snippet
 */
export function formatFAQsHtml(faqs: FAQItem[]): string {
  const parts: string[] = [];
  parts.push('<div class="faq-section">');
  parts.push('<h2>Frequently Asked Questions</h2>');
  faqs.forEach((faq) => {
    parts.push('<div class="faq-item">');
    parts.push(`<h3>${escapeHtml(faq.question)}</h3>`);
    // Split answer into paragraphs if it contains double newlines
    const answerParagraphs = faq.answer.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    if (answerParagraphs.length > 1) {
      answerParagraphs.forEach((para) => {
        parts.push(`<p>${escapeHtml(para.trim())}</p>`);
      });
    } else {
      parts.push(`<p>${escapeHtml(faq.answer)}</p>`);
    }
    parts.push("</div>");
  });
  parts.push("</div>");
  return parts.join("\n");
}

/**
 * Format FAQs as JSON-LD FAQPage schema
 */
export function formatFAQsJsonLd(faqs: FAQItem[]): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
  return JSON.stringify(schema, null, 2);
}

/**
 * Format FAQs as Divi-friendly accordion blocks
 * Uses semantic HTML suitable for Divi text modules or accordion modules
 */
export function formatFAQsDivi(faqs: FAQItem[]): string {
  const parts: string[] = [];
  parts.push('<div class="et_pb_accordion et_pb_module">');
  faqs.forEach((faq) => {
    parts.push('<div class="et_pb_accordion_item">');
    parts.push(`<h3 class="et_pb_accordion_title">${escapeHtml(faq.question)}</h3>`);
    parts.push('<div class="et_pb_accordion_content">');
    // Split answer into paragraphs
    const answerParagraphs = faq.answer.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    if (answerParagraphs.length > 1) {
      answerParagraphs.forEach((para) => {
        parts.push(`<p>${escapeHtml(para.trim())}</p>`);
      });
    } else {
      parts.push(`<p>${escapeHtml(faq.answer)}</p>`);
    }
    parts.push("</div>");
    parts.push("</div>");
  });
  parts.push("</div>");
  return parts.join("\n");
}

