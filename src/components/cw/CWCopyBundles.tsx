"use client";

import { useState } from "react";
import { recordExport } from "@/lib/bdw/local-analytics";
import { isContentReadyForExport, type ContentOutput } from "@/lib/apps/content-writer/content-ready";

interface CWCopyBundlesProps {
  content: ContentOutput;
  isDark: boolean;
  storageKey?: string; // Optional storage key for analytics
}

// Format full content bundle
function formatFullContentBundle(content: ContentOutput): string {
  const parts: string[] = [];
  
  parts.push(`Title: ${content.title}`);
  parts.push(`SEO Title: ${content.seoTitle}`);
  parts.push(`Meta Description: ${content.metaDescription}`);
  parts.push(`Slug: ${content.slugSuggestion}`);
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
    });
  }
  
  if (content.socialBlurb) {
    parts.push("");
    parts.push("Social Blurb:");
    parts.push(content.socialBlurb);
  }
  
  return parts.join("\n");
}

// Format SEO bundle (title, meta, slug)
function formatSEOBundle(content: ContentOutput): string {
  return `Title: ${content.title}\nSEO Title: ${content.seoTitle}\nMeta Description: ${content.metaDescription}\nSlug: ${content.slugSuggestion}`;
}

// Format content-only bundle (sections only)
function formatContentOnlyBundle(content: ContentOutput): string {
  return content.sections.map(s => `${s.heading}\n${s.body}`).join("\n\n");
}

export default function CWCopyBundles({ content, isDark, storageKey }: CWCopyBundlesProps) {
  const [copiedBundle, setCopiedBundle] = useState<string | null>(null);

  // Guard: Prevent operations on empty/placeholder content
  if (!isContentReadyForExport(content)) {
    return (
      <div className={`text-center py-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        <p className="text-xs">Generate content to enable Copy & Export</p>
      </div>
    );
  }

  const handleCopy = async (bundleId: string, content: string, exportType?: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedBundle(bundleId);
      setTimeout(() => {
        setCopiedBundle(null);
      }, 2000);
      
      // Record export in analytics
      if (storageKey && exportType) {
        recordExport(storageKey, exportType);
      }
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
        Copy Bundles:
      </span>
      <button
        onClick={() => handleCopy("seo", formatSEOBundle(content), "bundle:seo")}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          copiedBundle === "seo"
            ? "bg-[#29c4a9] text-white"
            : isDark
            ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
            : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
        }`}
      >
        {copiedBundle === "seo" ? "Copied!" : "SEO Bundle"}
      </button>
      <button
        onClick={() => handleCopy("content", formatContentOnlyBundle(content), "bundle:content")}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          copiedBundle === "content"
            ? "bg-[#29c4a9] text-white"
            : isDark
            ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
            : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
        }`}
      >
        {copiedBundle === "content" ? "Copied!" : "Content Bundle"}
      </button>
      <button
        onClick={() => handleCopy("full", formatFullContentBundle(content), "bundle:full")}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          copiedBundle === "full"
            ? "bg-[#29c4a9] text-white"
            : isDark
            ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
            : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
        }`}
      >
        {copiedBundle === "full" ? "Copied!" : "Full Bundle"}
      </button>
    </div>
  );
}

