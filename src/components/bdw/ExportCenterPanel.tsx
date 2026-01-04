"use client";

import { useState } from "react";
import {
  formatFullPackPlainText,
  formatFullPackMarkdown,
  formatWebsiteHtmlSnippet,
  formatGBPBlock,
  formatWebsiteAboutBlock,
  formatSocialBioBlock,
  formatFAQBlock,
  formatMetaBlock,
  formatForGBP,
  formatForDivi,
  formatForDirectory,
  convertToDestinationInput,
  type BusinessDescriptionResponseExport as BusinessDescriptionResponse,
} from "@/lib/bdw";
import { recordExport } from "@/lib/bdw/local-analytics";

interface ExportCenterPanelProps {
  result: BusinessDescriptionResponse;
  isDark: boolean;
  storageKey?: string; // Optional storage key for analytics
}

export default function ExportCenterPanel({ result, isDark, storageKey }: ExportCenterPanelProps) {
  const [copiedItems, setCopiedItems] = useState<Record<string, string>>({});

  const handleCopy = async (itemId: string, content: string, exportType?: string) => {
    try {
      // Check if content is empty or just a placeholder message
      const isEmpty = !content || 
        content.trim() === "" || 
        content.includes("No content available") ||
        content.includes("Generate content to enable exports");
      
      if (isEmpty) {
        // Show helpful message instead of copying placeholder
        alert("No content available for this export. Please generate content first.");
        return;
      }

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
      alert("Failed to copy to clipboard. Please try again.");
    }
  };

  const handleDownload = (content: string, filename: string, mimeType: string, exportType?: string) => {
    // Check if content is empty or just a placeholder message
    const isEmpty = !content || 
      content.trim() === "" || 
      content.includes("No content available") ||
      content.includes("Generate content to enable exports");
    
    if (isEmpty) {
      // Show helpful message instead of downloading placeholder
      alert("No content available for this export. Please generate content first.");
      return;
    }

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

  // Check if content exists
  const hasContent =
    result.obdListingDescription ||
    result.websiteAboutUs ||
    result.googleBusinessDescription ||
    result.socialBioPack?.facebookBio ||
    result.taglineOptions?.length ||
    result.elevatorPitch ||
    result.faqSuggestions?.length ||
    result.metaDescription;

  if (!hasContent) {
    return (
      <div className={`text-center py-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        <p className="text-sm">Generate content to enable exports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Quick Exports */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Quick Exports
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleCopy("export-plain-text", formatFullPackPlainText(result), "copy:plain")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedItems["export-plain-text"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-plain-text"] ? "Copied!" : "Copy as Plain Text (Full Marketing Pack)"}
          </button>
          <button
            onClick={() => handleCopy("export-markdown", formatFullPackMarkdown(result), "copy:markdown")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedItems["export-markdown"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-markdown"] ? "Copied!" : "Copy as Markdown (Full Marketing Pack)"}
          </button>
          <button
            onClick={() => handleCopy("export-html", formatWebsiteHtmlSnippet(result), "copy:html")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedItems["export-html"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-html"] ? "Copied!" : "Copy as HTML Snippet (Website/About)"}
          </button>
        </div>
      </div>

      {/* Section 2: Downloads */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Downloads
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleDownload(formatFullPackPlainText(result), "marketing-pack.txt", "text/plain", "download:txt")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            Download .txt (Full Marketing Pack)
          </button>
          <button
            onClick={() => handleDownload(formatFullPackMarkdown(result), "marketing-pack.md", "text/markdown", "download:md")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            Download .md (Full Marketing Pack)
          </button>
        </div>
      </div>

      {/* Section 3: Destination Exports */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Destination Exports
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const input = convertToDestinationInput(result);
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
              const input = convertToDestinationInput(result);
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
              const input = convertToDestinationInput(result);
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

      {/* Section 4: Paste-ready Blocks */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Paste-ready Blocks
        </h4>
        <div className="space-y-4">
          {/* GBP Block */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
            <div className="flex items-start justify-between mb-2">
              <p className={`font-medium text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>GBP Block</p>
              <button
                onClick={() => handleCopy("block-gbp", formatGBPBlock(result), "block:gbp")}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {copiedItems["block-gbp"] ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
              {formatGBPBlock(result)}
            </p>
          </div>

          {/* Website/About Block */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
            <div className="flex items-start justify-between mb-2">
              <p className={`font-medium text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>Website/About Block</p>
              <button
                onClick={() => handleCopy("block-website", formatWebsiteAboutBlock(result), "block:website")}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {copiedItems["block-website"] ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
              {formatWebsiteAboutBlock(result)}
            </p>
          </div>

          {/* Social Bio Block */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
            <div className="flex items-start justify-between mb-2">
              <p className={`font-medium text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>Social Bio Block</p>
              <button
                onClick={() => handleCopy("block-social-bio", formatSocialBioBlock(result), "block:social-bio")}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {copiedItems["block-social-bio"] ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
              {formatSocialBioBlock(result)}
            </p>
          </div>

          {/* FAQ Block */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
            <div className="flex items-start justify-between mb-2">
              <p className={`font-medium text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>FAQ Block</p>
              <button
                onClick={() => handleCopy("block-faq", formatFAQBlock(result), "block:faq")}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {copiedItems["block-faq"] ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
              {formatFAQBlock(result)}
            </p>
          </div>

          {/* Meta Block */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
            <div className="flex items-start justify-between mb-2">
              <p className={`font-medium text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>Meta Block</p>
              <button
                onClick={() => handleCopy("block-meta", formatMetaBlock(result), "block:meta")}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {copiedItems["block-meta"] ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
              {formatMetaBlock(result)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

