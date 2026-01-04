"use client";

import type { WebDraftPayload } from "@/lib/handoff/types";

interface WebDraftImportReadyBannerProps {
  isDark: boolean;
  payload: WebDraftPayload;
  onReview: () => void;
  onDismiss: () => void;
}

export default function WebDraftImportReadyBanner({
  isDark,
  payload,
  onReview,
  onDismiss,
}: WebDraftImportReadyBannerProps) {
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
            We found a website draft from AI Content Writer. Review and import it?
          </div>
          <div
            className={`text-xs ${
              isDark ? "text-blue-400" : "text-blue-600"
            }`}
          >
            Title: {payload.content.title} • {payload.content.sections.length} section{payload.content.sections.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onReview}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDark
                ? "bg-[#29c4a9] text-white hover:bg-[#22ad93] focus:ring-[#29c4a9]"
                : "bg-[#29c4a9] text-white hover:bg-[#22ad93] focus:ring-[#29c4a9]"
            }`}
            aria-label="Review draft from AI Content Writer"
          >
            Review Draft
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

