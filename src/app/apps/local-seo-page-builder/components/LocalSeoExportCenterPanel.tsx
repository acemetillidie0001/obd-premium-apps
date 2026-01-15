"use client";

import { useMemo, useState } from "react";
import { recordExport } from "@/lib/bdw/local-analytics";
import {
  formatForGBP,
  formatForDivi,
  formatForDirectory,
  type DestinationInput,
} from "@/lib/bdw";
import type { FAQItem, PageSections, SEOPack } from "../types";

function safeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

function handleDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function splitIntoSections(pageCopy: string): Array<{ heading?: string; body: string }> {
  const sections: Array<{ heading?: string; body: string }> = [];
  const paragraphs = pageCopy.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  paragraphs.forEach((para, idx) => {
    const isHeading = para.length < 100 && !para.includes(".");
    if (isHeading && idx === 0) {
      sections.push({ heading: para.trim(), body: "" });
    } else {
      if (sections.length > 0 && !sections[sections.length - 1].body) {
        sections[sections.length - 1].body = para.trim();
      } else {
        sections.push({ body: para.trim() });
      }
    }
  });
  return sections;
}

function formatPlainTextPack(args: {
  seoPack?: SEOPack;
  pageCopy: string;
  faqs: FAQItem[];
  schemaJsonLd?: string;
}): string {
  const { seoPack, pageCopy, faqs } = args;
  let text = `LOCAL SEO PAGE CONTENT\n`;
  text += `Generated: ${new Date().toLocaleString()}\n\n`;
  text += "=".repeat(50) + "\n\n";

  if (seoPack) {
    text += `SEO PACK\n${"-".repeat(50)}\n`;
    text += `Meta Title: ${seoPack.metaTitle}\n`;
    text += `Meta Description: ${seoPack.metaDescription}\n`;
    text += `Slug: ${seoPack.slug}\n`;
    text += `H1: ${seoPack.h1}\n\n`;
  }

  text += `PAGE COPY\n${"-".repeat(50)}\n`;
  text += `${pageCopy}\n\n`;

  if (faqs.length > 0) {
    text += `FAQ SECTION\n${"-".repeat(50)}\n`;
    faqs.forEach((faq, i) => {
      text += `Q${i + 1}: ${faq.question}\n`;
      text += `A${i + 1}: ${faq.answer}\n\n`;
    });
  }

  return text;
}

function formatMarkdownPack(args: { seoPack?: SEOPack; pageCopy: string; faqs: FAQItem[] }): string {
  const { seoPack, pageCopy, faqs } = args;
  let md = `# ${seoPack?.h1 || "Local SEO Page Content"}\n\n`;
  if (seoPack) {
    md += `**Meta Title:** ${seoPack.metaTitle}\n\n`;
    md += `**Meta Description:** ${seoPack.metaDescription}\n\n`;
    md += `**Slug:** \`${seoPack.slug}\`\n\n`;
  }
  md += `${pageCopy}\n\n`;
  if (faqs.length > 0) {
    md += `## Frequently Asked Questions\n\n`;
    faqs.forEach((faq) => {
      md += `### ${faq.question}\n\n`;
      md += `${faq.answer}\n\n`;
    });
  }
  return md;
}

function formatHtmlPack(args: { seoPack?: SEOPack; pageCopy: string; faqs: FAQItem[] }): string {
  const { seoPack, pageCopy, faqs } = args;
  const escapeTitle = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapeAttr = (s: string) => s.replace(/"/g, "&quot;");
  let html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n`;
  html += `  <meta charset="UTF-8">\n`;
  html += `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n`;
  if (seoPack) {
    html += `  <title>${escapeTitle(seoPack.metaTitle)}</title>\n`;
    html += `  <meta name="description" content="${escapeAttr(seoPack.metaDescription)}">\n`;
  }
  html += `</head>\n<body>\n`;
  if (seoPack?.h1) html += `<h1>${seoPack.h1}</h1>\n`;
  html += pageCopy.replace(/\n/g, "\n  ");
  if (faqs.length > 0) {
    html += `\n\n<h2>Frequently Asked Questions</h2>\n`;
    faqs.forEach((faq) => {
      html += `\n<h3>${faq.question}</h3>\n`;
      html += `<p>${faq.answer}</p>\n`;
    });
  }
  html += `\n</body>\n</html>`;
  return html;
}

function buildDestinationInput(args: {
  seoPack?: SEOPack;
  pageCopy: string;
  faqs: FAQItem[];
  pageSections?: PageSections;
}): DestinationInput {
  const { seoPack, pageCopy, faqs, pageSections } = args;

  const sections =
    pageSections
      ? ([
          { heading: "Hero", body: pageSections.hero },
          { heading: "Intro", body: pageSections.intro },
          { heading: "Services", body: pageSections.services },
          { heading: "Why Choose Us", body: pageSections.whyChooseUs },
          { heading: "Areas Served", body: pageSections.areasServed },
          { heading: "Closing CTA", body: pageSections.closingCta },
        ] as Array<{ heading?: string; body: string }>)
      : splitIntoSections(pageCopy);

  const convertedFaqs = faqs.map((f) => ({ q: f.question, a: f.answer }));

  return {
    title: seoPack?.h1 || "Local SEO Page",
    slug: seoPack?.slug,
    metaDescription: seoPack?.metaDescription,
    description: pageCopy,
    sections: sections.length > 0 ? sections : undefined,
    faqs: convertedFaqs.length > 0 ? convertedFaqs : undefined,
  };
}

export default function LocalSeoExportCenterPanel({
  isDark,
  storageKey,
  businessName,
  phone,
  websiteUrl,
  includeSchema,
  pageUrl,
  activeSeoPack,
  activePageCopy,
  activeFaqs,
  activePageSections,
  activeSchemaJsonLd,
}: {
  isDark: boolean;
  storageKey: string;
  businessName: string;
  phone?: string;
  websiteUrl?: string;
  includeSchema?: boolean;
  pageUrl?: string;
  activeSeoPack?: SEOPack;
  activePageCopy: string;
  activeFaqs: FAQItem[];
  activePageSections?: PageSections;
  activeSchemaJsonLd?: string;
}) {
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const hasActiveContent = useMemo(() => {
    return (
      (activeSeoPack !== undefined) ||
      (activePageCopy && activePageCopy.trim().length > 0) ||
      (activeFaqs && activeFaqs.length > 0)
    );
  }, [activeSeoPack, activePageCopy, activeFaqs]);

  const blockers = useMemo(() => {
    const b: string[] = [];
    if (!hasActiveContent) b.push("Generate content to enable exports.");
    return b;
  }, [hasActiveContent]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (!phone || !phone.trim()) w.push("Phone is missing (optional, but recommended).");
    if (!websiteUrl || !websiteUrl.trim()) w.push("Website URL is missing (optional, but recommended).");
    if (includeSchema && (!pageUrl || !pageUrl.trim())) {
      w.push("Schema is enabled, but Page URL is missing (schema needs a real page URL).");
    }
    return w;
  }, [phone, websiteUrl, includeSchema, pageUrl]);

  const packPlain = useMemo(
    () => formatPlainTextPack({ seoPack: activeSeoPack, pageCopy: activePageCopy, faqs: activeFaqs, schemaJsonLd: activeSchemaJsonLd }),
    [activeSeoPack, activePageCopy, activeFaqs, activeSchemaJsonLd]
  );
  const packMarkdown = useMemo(
    () => formatMarkdownPack({ seoPack: activeSeoPack, pageCopy: activePageCopy, faqs: activeFaqs }),
    [activeSeoPack, activePageCopy, activeFaqs]
  );
  const packHtml = useMemo(
    () => formatHtmlPack({ seoPack: activeSeoPack, pageCopy: activePageCopy, faqs: activeFaqs }),
    [activeSeoPack, activePageCopy, activeFaqs]
  );

  const destInput = useMemo(
    () =>
      buildDestinationInput({
        seoPack: activeSeoPack,
        pageCopy: activePageCopy,
        faqs: activeFaqs,
        pageSections: activePageSections,
      }),
    [activeSeoPack, activePageCopy, activeFaqs, activePageSections]
  );

  const doCopy = async (id: string, content: string, exportType: string) => {
    if (blockers.length > 0) return;
    await navigator.clipboard.writeText(content);
    setCopied((p) => ({ ...p, [id]: true }));
    setTimeout(() => setCopied((p) => ({ ...p, [id]: false })), 1500);
    recordExport(storageKey, exportType);
  };

  const doDownload = (content: string, filename: string, mime: string, exportType: string) => {
    if (blockers.length > 0) return;
    handleDownload(content, filename, mime);
    recordExport(storageKey, exportType);
  };

  const downloadSchemaJson = () => {
    if (!activeSchemaJsonLd) return;
    if (blockers.length > 0) return;
    try {
      const parsed = JSON.parse(activeSchemaJsonLd);
      const json = JSON.stringify(parsed, null, 2);
      const name = safeName(businessName || "page");
      doDownload(json, `schema-${name || "page"}-${Date.now()}.json`, "application/json", "download:schema-json");
    } catch {
      // Fallback: download raw
      const name = safeName(businessName || "page");
      doDownload(activeSchemaJsonLd, `schema-${name || "page"}-${Date.now()}.json`, "application/json", "download:schema-json");
    }
  };

  const disabled = blockers.length > 0;
  const buttonBase = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? "bg-[#29c4a9] text-white"
        : isDark
        ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
        : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
    } ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`;

  return (
    <div className="space-y-6">
      {/* Readiness */}
      {(blockers.length > 0 || warnings.length > 0) && (
        <div
          className={`rounded-lg border p-4 ${
            isDark ? "bg-slate-900/40 border-slate-700" : "bg-white border-slate-200"
          }`}
        >
          {blockers.length > 0 && (
            <div className="mb-3">
              <p className={`text-sm font-semibold ${isDark ? "text-red-200" : "text-red-700"}`}>
                Blockers
              </p>
              <ul className={`mt-1 text-sm list-disc list-inside ${isDark ? "text-red-100" : "text-red-700"}`}>
                {blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <p className={`text-sm font-semibold ${isDark ? "text-amber-200" : "text-amber-800"}`}>
                Warnings
              </p>
              <ul className={`mt-1 text-sm list-disc list-inside ${isDark ? "text-amber-100" : "text-amber-700"}`}>
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Quick Exports */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Quick Exports (Active Content)
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => doCopy("plain", packPlain, "copy:plain")}
            className={buttonBase(!!copied["plain"])}
            disabled={disabled}
          >
            {copied["plain"] ? "Copied!" : "Copy Plain Text"}
          </button>
          <button
            onClick={() => doCopy("md", packMarkdown, "copy:markdown")}
            className={buttonBase(!!copied["md"])}
            disabled={disabled}
          >
            {copied["md"] ? "Copied!" : "Copy Markdown"}
          </button>
          <button
            onClick={() => doCopy("html", packHtml, "copy:html")}
            className={buttonBase(!!copied["html"])}
            disabled={disabled}
          >
            {copied["html"] ? "Copied!" : "Copy HTML"}
          </button>
        </div>
      </div>

      {/* Downloads */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Downloads
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const name = safeName(businessName || "page");
              doDownload(packPlain, `seo-page-${name || "page"}-${Date.now()}.txt`, "text/plain", "download:txt");
            }}
            className={buttonBase(false)}
            disabled={disabled}
          >
            Download .txt
          </button>
          <button
            onClick={() => {
              const name = safeName(businessName || "page");
              doDownload(packMarkdown, `seo-page-${name || "page"}-${Date.now()}.md`, "text/markdown", "download:md");
            }}
            className={buttonBase(false)}
            disabled={disabled}
          >
            Download .md
          </button>
          <button
            onClick={() => {
              const name = safeName(businessName || "page");
              doDownload(packHtml, `seo-page-${name || "page"}-${Date.now()}.html`, "text/html", "download:html");
            }}
            className={buttonBase(false)}
            disabled={disabled}
          >
            Download .html
          </button>
          <button
            onClick={downloadSchemaJson}
            className={buttonBase(false)}
            disabled={disabled || !activeSchemaJsonLd}
            title={!activeSchemaJsonLd ? "Schema not available for this draft" : "Download schema JSON"}
          >
            Download schema .json
          </button>
        </div>
      </div>

      {/* Destination Exports */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Destination Exports (Reuse Kit)
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => doCopy("dest-gbp", formatForGBP(destInput), "dest:gbp")}
            className={buttonBase(!!copied["dest-gbp"])}
            disabled={disabled}
          >
            {copied["dest-gbp"] ? "Copied!" : "Copy for GBP"}
          </button>
          <button
            onClick={() => doCopy("dest-divi", formatForDivi(destInput), "dest:divi")}
            className={buttonBase(!!copied["dest-divi"])}
            disabled={disabled}
          >
            {copied["dest-divi"] ? "Copied!" : "Copy for Divi"}
          </button>
          <button
            onClick={() => doCopy("dest-directory", formatForDirectory(destInput), "dest:directory")}
            className={buttonBase(!!copied["dest-directory"])}
            disabled={disabled}
          >
            {copied["dest-directory"] ? "Copied!" : "Copy for Directory"}
          </button>
        </div>
      </div>
    </div>
  );
}


