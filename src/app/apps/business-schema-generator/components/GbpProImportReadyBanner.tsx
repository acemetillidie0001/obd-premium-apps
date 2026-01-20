"use client";

import type { GbpToSchemaGeneratorHandoffV1 } from "@/lib/apps/google-business-pro/handoff";

export default function GbpProImportReadyBanner({
  isDark,
  payload,
  onReview,
  onDismiss,
}: {
  isDark: boolean;
  payload: GbpToSchemaGeneratorHandoffV1;
  onReview: () => void;
  onDismiss: () => void;
}) {
  const summaryParts: string[] = [];
  if (payload.context.businessName) summaryParts.push(payload.context.businessName);
  const svcCount = payload.facts.services?.length ?? 0;
  const faqCount = payload.facts.faqs?.length ?? 0;
  if (svcCount > 0) summaryParts.push(`Services: ${svcCount}`);
  if (faqCount > 0) summaryParts.push(`FAQs: ${faqCount}`);

  return (
    <div
      className={`mb-6 rounded-xl border p-4 ${
        isDark ? "bg-blue-900/20 border-blue-700" : "bg-blue-50 border-blue-200"
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold mb-1 ${isDark ? "text-blue-300" : "text-blue-800"}`}>
            Import Ready
          </div>
          <div className={`text-sm mb-2 ${isDark ? "text-blue-200" : "text-blue-700"}`}>
            We found draft facts from Google Business Profile Pro. Import them into Schema Generator?
          </div>
          {summaryParts.length > 0 && (
            <div className={`text-xs ${isDark ? "text-blue-400" : "text-blue-600"}`}>
              {summaryParts.join(" • ")}
            </div>
          )}
          <div className={`text-xs mt-1 ${isDark ? "text-blue-400/80" : "text-blue-700/80"}`}>
            Additive only — nothing is applied automatically, and existing fields are not overwritten.
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onReview}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "bg-[#29c4a9] text-white hover:bg-[#22ad93]"
                : "bg-[#29c4a9] text-white hover:bg-[#22ad93]"
            }`}
          >
            Review Import
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

