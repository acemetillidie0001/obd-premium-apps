"use client";

interface FAQImportBannerProps {
  isDark: boolean;
  faqCount: number;
  isAlreadyImported: boolean;
  onImport: () => void;
  onDismiss: () => void;
}

export default function FAQImportBanner({
  isDark,
  faqCount,
  isAlreadyImported,
  onImport,
  onDismiss,
}: FAQImportBannerProps) {
  return (
    <div
      className={`mb-6 rounded-xl border p-4 ${
        isDark
          ? "bg-slate-800/50 border-slate-700"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`text-sm font-medium ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Import FAQs from AI FAQ Generator{isAlreadyImported ? " (already imported)" : ""}
          </div>
          <div
            className={`text-xs ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {faqCount} FAQ{faqCount !== 1 ? "s" : ""} ready to import
            {isAlreadyImported && (
              <span className="ml-2">
                • This handoff was already imported in this session.
              </span>
            )}
            <span className="ml-2">• Draft only — nothing is imported until you confirm.</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onImport}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "bg-[#29c4a9] text-white hover:bg-[#22ad93]"
                : "bg-[#29c4a9] text-white hover:bg-[#22ad93]"
            }`}
          >
            Review & Import
          </button>
          <button
            onClick={onDismiss}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

