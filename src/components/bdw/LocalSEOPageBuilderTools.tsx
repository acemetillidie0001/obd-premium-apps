"use client";

import { useState } from "react";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import BrandProfilePanel from "./BrandProfilePanel";
import LocalSEOTextQualityControls from "./LocalSEOTextQualityControls";
import LocalSEOFixPacks from "./LocalSEOFixPacks";
import AnalyticsDetails from "./AnalyticsDetails";
import { type BrandProfile } from "@/lib/bdw";
import { safeTrimToLimit } from "@/lib/bdw";
import { recordExport } from "@/lib/bdw/local-analytics";
import {
  formatForGBP,
  formatForDivi,
  formatForDirectory,
  type DestinationInput,
} from "@/lib/bdw";

interface LocalSEOPageBuilderToolsProps {
  pageCopy: string;
  onPageCopyChange: (newCopy: string) => void;
  seoPack?: {
    metaTitle: string;
    metaDescription: string;
    slug: string;
    h1: string;
  };
  faqs?: Array<{ question: string; answer: string }>;
  formValues: {
    businessName: string;
    services?: string;
    keywords?: string;
    primaryService?: string;
    city?: string;
    state?: string;
  };
  isDark: boolean;
  onApplyBrandProfile?: (profile: BrandProfile, fillEmptyOnly: boolean) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export default function LocalSEOPageBuilderTools({
  pageCopy,
  onPageCopyChange,
  seoPack,
  faqs,
  formValues,
  isDark,
  onApplyBrandProfile,
  onUndo,
  canUndo = false,
}: LocalSEOPageBuilderToolsProps) {
  const [activeTab, setActiveTab] = useState<"brand" | "fix" | "quality" | "export">("brand");
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const tabs = [
    { id: "brand" as const, label: "Brand Profile" },
    { id: "fix" as const, label: "Fix Packs" },
    { id: "quality" as const, label: "Quality" },
    { id: "export" as const, label: "Export" },
  ];

  const handleCopy = async (content: string, itemId: string, exportType?: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedItem(itemId);
      setTimeout(() => setCopiedItem(null), 2000);
      
      // Record export in analytics
      if (exportType) {
        recordExport("lseo-analytics", exportType);
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
    if (exportType) {
      recordExport("lseo-analytics", exportType);
    }
  };

  // Convert Local SEO data to DestinationInput
  const buildDestinationInput = (): DestinationInput => {
    // Build sections from page copy
    const sections: Array<{ heading?: string; body: string }> = [];
    
    // Split page copy into paragraphs (simple approach)
    const paragraphs = pageCopy.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    paragraphs.forEach((para, idx) => {
      // Check if paragraph looks like a heading (short, no period)
      const isHeading = para.length < 100 && !para.includes(".");
      if (isHeading && idx === 0) {
        // First short paragraph might be a heading
        sections.push({
          heading: para.trim(),
          body: "",
        });
      } else {
        // Add to last section or create new one
        if (sections.length > 0 && !sections[sections.length - 1].body) {
          sections[sections.length - 1].body = para.trim();
        } else {
          sections.push({
            body: para.trim(),
          });
        }
      }
    });

    // Convert FAQs
    const convertedFaqs = faqs?.map((faq) => ({
      q: faq.question,
      a: faq.answer,
    })) || [];

    // Build description from page copy
    const description = pageCopy || "";

    return {
      title: seoPack?.h1 || formValues.businessName,
      slug: seoPack?.slug,
      metaDescription: seoPack?.metaDescription,
      description,
      sections: sections.length > 0 ? sections : undefined,
      faqs: convertedFaqs.length > 0 ? convertedFaqs : undefined,
    };
  };

  // Build export content
  const buildPlainTextExport = () => {
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
    
    if (faqs && faqs.length > 0) {
      text += `FAQ SECTION\n${"-".repeat(50)}\n`;
      faqs.forEach((faq, i) => {
        text += `Q${i + 1}: ${faq.question}\n`;
        text += `A${i + 1}: ${faq.answer}\n\n`;
      });
    }
    
    return text;
  };

  const buildMarkdownExport = () => {
    let md = `# ${seoPack?.h1 || "SEO Page Content"}\n\n`;
    
    if (seoPack) {
      md += `**Meta Title:** ${seoPack.metaTitle}\n\n`;
      md += `**Meta Description:** ${seoPack.metaDescription}\n\n`;
    }
    
    md += `${pageCopy}\n\n`;
    
    if (faqs && faqs.length > 0) {
      md += `## Frequently Asked Questions\n\n`;
      faqs.forEach((faq) => {
        md += `### ${faq.question}\n\n`;
        md += `${faq.answer}\n\n`;
      });
    }
    
    return md;
  };

  const buildHtmlExport = () => {
    let html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n`;
    html += `  <meta charset="UTF-8">\n`;
    html += `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n`;
    if (seoPack) {
      html += `  <title>${seoPack.metaTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title>\n`;
      html += `  <meta name="description" content="${seoPack.metaDescription.replace(/"/g, "&quot;")}">\n`;
    }
    html += `</head>\n<body>\n`;
    html += `<h1>${seoPack?.h1 || ""}</h1>\n`;
    html += pageCopy.replace(/\n/g, "\n  ");
    if (faqs && faqs.length > 0) {
      html += `\n\n<h2>Frequently Asked Questions</h2>\n`;
      faqs.forEach((faq) => {
        html += `\n<h3>${faq.question}</h3>\n`;
        html += `<p>${faq.answer}</p>\n`;
      });
    }
    html += `\n</body>\n</html>`;
    return html;
  };

  return (
    <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
      <OBDHeading level={2} isDark={isDark} className="mb-4">
        BDW Tools
      </OBDHeading>

      {/* Tabs */}
      <div className={`flex flex-wrap gap-2 mb-6 border-b items-center justify-between ${
        isDark ? "border-slate-700" : "border-slate-200"
      }`}>
        <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
        </div>
        <AnalyticsDetails storageKey="lseo-analytics" isDark={isDark} />
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "brand" && (
          <BrandProfilePanel
            businessName={formValues.businessName}
            isDark={isDark}
            onApplyToForm={onApplyBrandProfile || (() => {})}
          />
        )}

        {activeTab === "fix" && (
          <LocalSEOFixPacks
            text={pageCopy}
            isDark={isDark}
            onApplyFix={onPageCopyChange}
            onUndo={onUndo}
            canUndo={canUndo}
          />
        )}

        {activeTab === "quality" && (
          <LocalSEOTextQualityControls
            text={pageCopy}
            services={formValues.services || formValues.primaryService}
            keywords={formValues.keywords}
            isDark={isDark}
            onApplyFix={onPageCopyChange}
          />
        )}

        {activeTab === "export" && (
          <div className="space-y-6">
            {!pageCopy || pageCopy.trim().length === 0 ? (
              <div className={`text-center py-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <p className="text-sm">Generate content to enable exports.</p>
              </div>
            ) : (
              <>
                {/* Quick Exports */}
                <div>
                  <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
                    Quick Exports
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleCopy(buildPlainTextExport(), "plain-text", "copy:plain")}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        copiedItem === "plain-text"
                          ? "bg-[#29c4a9] text-white"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                          : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                      }`}
                    >
                      {copiedItem === "plain-text" ? "Copied!" : "Copy as Plain Text"}
                    </button>
                    <button
                      onClick={() => handleCopy(buildMarkdownExport(), "markdown", "copy:markdown")}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        copiedItem === "markdown"
                          ? "bg-[#29c4a9] text-white"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                          : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                      }`}
                    >
                      {copiedItem === "markdown" ? "Copied!" : "Copy as Markdown"}
                    </button>
                    <button
                      onClick={() => handleCopy(buildHtmlExport(), "html", "copy:html")}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        copiedItem === "html"
                          ? "bg-[#29c4a9] text-white"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                          : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                      }`}
                    >
                      {copiedItem === "html" ? "Copied!" : "Copy as HTML"}
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
                        const input = buildDestinationInput();
                        handleCopy(formatForGBP(input), "dest-gbp", "dest:gbp");
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        copiedItem === "dest-gbp"
                          ? "bg-[#29c4a9] text-white"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                          : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                      }`}
                    >
                      {copiedItem === "dest-gbp" ? "Copied!" : "Copy for GBP"}
                    </button>
                    <button
                      onClick={() => {
                        const input = buildDestinationInput();
                        handleCopy(formatForDivi(input), "dest-divi", "dest:divi");
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        copiedItem === "dest-divi"
                          ? "bg-[#29c4a9] text-white"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                          : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                      }`}
                    >
                      {copiedItem === "dest-divi" ? "Copied!" : "Copy for Divi"}
                    </button>
                    <button
                      onClick={() => {
                        const input = buildDestinationInput();
                        handleCopy(formatForDirectory(input), "dest-directory", "dest:directory");
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        copiedItem === "dest-directory"
                          ? "bg-[#29c4a9] text-white"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                          : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                      }`}
                    >
                      {copiedItem === "dest-directory" ? "Copied!" : "Copy for Directory"}
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
                      onClick={() => handleDownload(buildPlainTextExport(), "seo-page-content.txt", "text/plain", "download:txt")}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                          : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                      }`}
                    >
                      Download .txt
                    </button>
                    <button
                      onClick={() => handleDownload(buildMarkdownExport(), "seo-page-content.md", "text/markdown", "download:md")}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                          : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                      }`}
                    >
                      Download .md
                    </button>
                    <button
                      onClick={() => handleDownload(buildHtmlExport(), "seo-page-content.html", "text/html", "download:html")}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                          : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                      }`}
                    >
                      Download .html
                    </button>
                  </div>
                </div>

                {/* Copy Bundles */}
                {seoPack && (
                  <div>
                    <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
                      Copy Bundles
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleCopy(
                          `Meta Title: ${seoPack.metaTitle}\nMeta Description: ${seoPack.metaDescription}\nH1: ${seoPack.h1}`,
                          "seo-pack"
                        )}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          copiedItem === "seo-pack"
                            ? "bg-[#29c4a9] text-white"
                            : isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                            : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                        }`}
                      >
                        {copiedItem === "seo-pack" ? "Copied!" : "Copy SEO Pack"}
                      </button>
                      <button
                        onClick={() => handleCopy(pageCopy, "page-copy")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          copiedItem === "page-copy"
                            ? "bg-[#29c4a9] text-white"
                            : isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                            : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                        }`}
                      >
                        {copiedItem === "page-copy" ? "Copied!" : "Copy Page Content"}
                      </button>
                      {faqs && faqs.length > 0 && (
                        <button
                          onClick={() => handleCopy(
                            faqs.map((faq, i) => `Q${i + 1}: ${faq.question}\nA${i + 1}: ${faq.answer}`).join("\n\n"),
                            "faqs"
                          )}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            copiedItem === "faqs"
                              ? "bg-[#29c4a9] text-white"
                              : isDark
                              ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                              : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                          }`}
                        >
                          {copiedItem === "faqs" ? "Copied!" : "Copy FAQs"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </OBDPanel>
  );
}

