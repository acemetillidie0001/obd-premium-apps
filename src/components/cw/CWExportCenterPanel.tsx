"use client";

import { useState } from "react";
import { recordExport } from "@/lib/bdw/local-analytics";
import {
  formatForGBP,
  formatForDivi,
  formatForDirectory,
  type DestinationInput,
} from "@/lib/bdw";
import { isContentReadyForExport, type ContentOutput } from "@/lib/apps/content-writer/content-ready";

interface CWExportCenterPanelProps {
  content: ContentOutput;
  isDark: boolean;
  storageKey?: string; // Optional storage key for analytics
}

// Format content as plain text
function formatContentPlainText(content: ContentOutput): string {
  const parts: string[] = [];
  
  parts.push(`Title: ${content.title}`);
  parts.push(`SEO Title: ${content.seoTitle}`);
  parts.push(`Meta Description: ${content.metaDescription}`);
  parts.push(`Slug: ${content.slugSuggestion}`);
  parts.push("");
  parts.push("Outline:");
  content.outline.forEach((item, idx) => {
    parts.push(`${idx + 1}. ${item}`);
  });
  parts.push("");
  parts.push("Content:");
  content.sections.forEach((section) => {
    parts.push(`\n${section.heading}`);
    parts.push(section.body);
  });
  
  if (content.faq.length > 0) {
    parts.push("");
    parts.push("FAQ:");
    content.faq.forEach((faq) => {
      parts.push(`Q: ${faq.question}`);
      parts.push(`A: ${faq.answer}`);
      parts.push("");
    });
  }
  
  if (content.socialBlurb) {
    parts.push("");
    parts.push("Social Blurb:");
    parts.push(content.socialBlurb);
  }
  
  return parts.join("\n");
}

// Format content as markdown
function formatContentMarkdown(content: ContentOutput): string {
  const parts: string[] = [];
  
  parts.push(`# ${content.title}\n`);
  parts.push(`**SEO Title:** ${content.seoTitle}\n`);
  parts.push(`**Meta Description:** ${content.metaDescription}\n`);
  parts.push(`**Slug:** ${content.slugSuggestion}\n`);
  parts.push("\n## Outline\n");
  content.outline.forEach((item, idx) => {
    parts.push(`${idx + 1}. ${item}`);
  });
  parts.push("\n## Content\n");
  content.sections.forEach((section) => {
    parts.push(`\n### ${section.heading}\n`);
    parts.push(section.body);
  });
  
  if (content.faq.length > 0) {
    parts.push("\n## FAQ\n");
    content.faq.forEach((faq) => {
      parts.push(`### Q: ${faq.question}\n`);
      parts.push(`${faq.answer}\n`);
    });
  }
  
  if (content.socialBlurb) {
    parts.push("\n## Social Blurb\n");
    parts.push(content.socialBlurb);
  }
  
  return parts.join("\n");
}

// Format content as HTML snippet
function formatContentHtml(content: ContentOutput): string {
  const parts: string[] = [];
  
  parts.push(`<h1>${content.title}</h1>`);
  parts.push(`<meta name="description" content="${content.metaDescription.replace(/"/g, "&quot;")}">`);
  parts.push("");
  content.sections.forEach((section) => {
    parts.push(`<h2>${section.heading}</h2>`);
    parts.push(`<p>${section.body.replace(/\n\n/g, "</p><p>")}</p>`);
  });
  
  if (content.faq.length > 0) {
    parts.push("<h2>FAQ</h2>");
    content.faq.forEach((faq) => {
      parts.push(`<h3>${faq.question}</h3>`);
      parts.push(`<p>${faq.answer}</p>`);
    });
  }
  
  return parts.join("\n");
}

// Convert ContentOutput to DestinationInput
function convertContentToDestinationInput(content: ContentOutput): DestinationInput {
  // Build description from sections
  const description = content.sections
    .map((s) => {
      if (s.heading) {
        return `${s.heading}\n\n${s.body}`;
      }
      return s.body;
    })
    .join("\n\n");

  // Convert FAQs
  const faqs = content.faq.map((faq) => ({
    q: faq.question,
    a: faq.answer,
  }));

  return {
    title: content.title,
    slug: content.slugSuggestion,
    metaDescription: content.metaDescription,
    description,
    sections: content.sections.map((s) => ({
      heading: s.heading,
      body: s.body,
    })),
    faqs: faqs.length > 0 ? faqs : undefined,
  };
}

export default function CWExportCenterPanel({ content, isDark, storageKey }: CWExportCenterPanelProps) {
  const [copiedItems, setCopiedItems] = useState<Record<string, string>>({});

  // Guard: Prevent operations on empty/placeholder content
  if (!isContentReadyForExport(content)) {
    return (
      <div className={`text-center py-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        <p className="text-sm">Generate content to enable Copy & Export</p>
      </div>
    );
  }

  const handleCopy = async (itemId: string, content: string, exportType?: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedItems((prev) => ({ ...prev, [itemId]: itemId }));
      setTimeout(() => {
        setCopiedItems((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }, 2000);
      
      // Record export in analytics
      if (storageKey && exportType) {
        recordExport(storageKey, exportType);
      }
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownload = (content: string, filename: string, mimeType: string, exportType?: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Record export in analytics
    if (storageKey && exportType) {
      recordExport(storageKey, exportType);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Exports */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Quick Exports
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleCopy("export-plain-text", formatContentPlainText(content), "copy:plain")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedItems["export-plain-text"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-plain-text"] ? "Copied!" : "Copy as Plain Text"}
          </button>
          <button
            onClick={() => handleCopy("export-markdown", formatContentMarkdown(content), "copy:markdown")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedItems["export-markdown"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-markdown"] ? "Copied!" : "Copy as Markdown"}
          </button>
          <button
            onClick={() => handleCopy("export-html", formatContentHtml(content), "copy:html")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedItems["export-html"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-html"] ? "Copied!" : "Copy as HTML"}
          </button>
        </div>
      </div>

      {/* Destination Exports */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Destination Exports
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const input = convertContentToDestinationInput(content);
              handleCopy("dest-gbp", formatForGBP(input), "dest:gbp");
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedItems["dest-gbp"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["dest-gbp"] ? "Copied!" : "Copy for GBP"}
          </button>
          <button
            onClick={() => {
              const input = convertContentToDestinationInput(content);
              handleCopy("dest-divi", formatForDivi(input), "dest:divi");
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedItems["dest-divi"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["dest-divi"] ? "Copied!" : "Copy for Divi"}
          </button>
          <button
            onClick={() => {
              const input = convertContentToDestinationInput(content);
              handleCopy("dest-directory", formatForDirectory(input), "dest:directory");
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedItems["dest-directory"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["dest-directory"] ? "Copied!" : "Copy for Directory"}
          </button>
        </div>
      </div>

      {/* Download Options */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Download Options
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleDownload(formatContentPlainText(content), "content.txt", "text/plain", "download:txt")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            Download as .txt
          </button>
          <button
            onClick={() => handleDownload(formatContentMarkdown(content), "content.md", "text/markdown", "download:md")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            Download as .md
          </button>
        </div>
      </div>

      {/* Individual Sections */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Individual Sections
        </h4>
        <div className="space-y-3">
          <div className={`rounded-lg border p-3 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                Meta Description
              </span>
              <button
                onClick={() => handleCopy("meta", content.metaDescription, "copy:meta")}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  copiedItems["meta"]
                    ? "bg-[#29c4a9] text-white"
                    : isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {copiedItems["meta"] ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              {content.metaDescription}
            </p>
          </div>

          {content.sections.map((section, idx) => (
            <div key={idx} className={`rounded-lg border p-3 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  {section.heading}
                </span>
                <button
                  onClick={() => handleCopy(`section-${idx}`, section.body)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    copiedItems[`section-${idx}`]
                      ? "bg-[#29c4a9] text-white"
                      : isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {copiedItems[`section-${idx}`] ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className={`text-sm whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                {section.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

