"use client";

import type { ContentWriterSchemaHandoff } from "@/lib/apps/business-schema-generator/handoff-parser";

interface ContentWriterSchemaImportReadyBannerProps {
  isDark: boolean;
  payload: ContentWriterSchemaHandoff;
  onReview: () => void;
  onDismiss: () => void;
}

export default function ContentWriterSchemaImportReadyBanner({
  isDark,
  payload,
  onReview,
  onDismiss,
}: ContentWriterSchemaImportReadyBannerProps) {
  // Build summary line
  const summaryParts: string[] = [];
  if (payload.mode === "faq") {
    summaryParts.push(`FAQs: ${payload.faqs.length}`);
  } else if (payload.mode === "page-meta") {
    const metaFields: string[] = [];
    if (payload.pageMeta.pageTitle) metaFields.push("Title");
    if (payload.pageMeta.pageDescription) metaFields.push("Description");
    if (payload.pageMeta.pageUrl) metaFields.push("Slug");
    if (metaFields.length > 0) {
      summaryParts.push(metaFields.join("/"));
    }
  }

  return (
    <div
      className={`mb-6 rounded-xl border p-4 ${
        isDark
          ? "bg-blue-900/20 border-blue-700"
          : "bg-blue-50 border-blue-200"
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-semibold mb-1 ${
              isDark ? "text-blue-300" : "text-blue-800"
            }`}
          >
            Import Ready
          </div>
          <div
            className={`text-sm mb-2 ${
              isDark ? "text-blue-200" : "text-blue-700"
            }`}
          >
            We found content from AI Content Writer. Import it into your Schema Generator?
          </div>
          {summaryParts.length > 0 && (
            <div
              className={`text-xs ${
                isDark ? "text-blue-400" : "text-blue-600"
              }`}
            >
              {summaryParts.join(" • ")}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onReview}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDark
                ? "bg-[#29c4a9] text-white hover:bg-[#22ad93] focus:ring-[#29c4a9]"
                : "bg-[#29c4a9] text-white hover:bg-[#22ad93] focus:ring-[#29c4a9]"
            }`}
            aria-label="Review import from AI Content Writer"
          >
            Review Import
          </button>
          <button
            onClick={onDismiss}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDark
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700 focus:ring-slate-500"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:ring-slate-400"
            }`}
            aria-label="Dismiss import banner"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

