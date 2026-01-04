"use client";

import { getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";
import type { ContentWriterHandoffPayload } from "@/lib/apps/content-writer/handoff-parser";

interface FAQImportBannerProps {
  isDark: boolean;
  payload: ContentWriterHandoffPayload;
  isAlreadyImported: boolean;
  onAddAsNewDraft: () => void;
  onAppendToCurrent: () => void;
  onDismiss: () => void;
  hasExistingContent: boolean;
}

// Extract FAQ count from markdown
function getFaqCountFromMarkdown(markdown: string): number {
  // Count ### headings (FAQ questions)
  const questionMatches = markdown.match(/^###\s+/gm);
  return questionMatches ? questionMatches.length : 0;
}

export default function FAQImportBanner({
  isDark,
  payload,
  isAlreadyImported,
  onAddAsNewDraft,
  onAppendToCurrent,
  onDismiss,
  hasExistingContent,
}: FAQImportBannerProps) {
  const faqCount = getFaqCountFromMarkdown(payload.markdown);
  const contextSummary = payload.context.businessName || payload.context.topic || "your business";

  return (
    <div
      className={`mb-6 rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        isDark
          ? "bg-blue-900/20 border-blue-700"
          : "bg-blue-50 border-blue-200"
      }`}
    >
      <div>
        <p
          className={`text-sm font-medium ${
            isDark ? "text-blue-300" : "text-blue-800"
          }`}
        >
          <strong>FAQ Section received from AI FAQ Generator{isAlreadyImported ? " (already imported)" : ""}</strong>
        </p>
        <p
          className={`text-xs mt-1 ${
            isDark ? "text-blue-400" : "text-blue-700"
          }`}
        >
          {faqCount > 0 && `${faqCount} FAQ${faqCount !== 1 ? "s" : ""} for ${contextSummary}`}
          {faqCount === 0 && `Content for ${contextSummary}`}
          {isAlreadyImported && (
            <span className="ml-2">
              • This handoff was already imported in this session.
            </span>
          )}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onAddAsNewDraft}
          disabled={isAlreadyImported}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
            isAlreadyImported
              ? isDark
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
              : getSecondaryButtonClasses(isDark)
          }`}
        >
          Add as New Draft
        </button>
        {hasExistingContent && (
          <button
            onClick={onAppendToCurrent}
            disabled={isAlreadyImported}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              isAlreadyImported
                ? isDark
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            Append to Current Draft
          </button>
        )}
        <button
          onClick={onDismiss}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
            isDark
              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

