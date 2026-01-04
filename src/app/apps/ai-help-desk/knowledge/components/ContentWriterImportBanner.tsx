"use client";

interface ContentWriterImportBannerProps {
  isDark: boolean;
  hasArticle: boolean;
  faqCount: number;
  isAlreadyImported: boolean;
  onImport: () => void;
  onDismiss: () => void;
}

export default function ContentWriterImportBanner({
  isDark,
  hasArticle,
  faqCount,
  isAlreadyImported,
  onImport,
  onDismiss,
}: ContentWriterImportBannerProps) {
  const importItems: string[] = [];
  if (hasArticle) importItems.push("Article");
  if (faqCount > 0) importItems.push(`${faqCount} FAQ${faqCount !== 1 ? "s" : ""}`);

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
            className={`text-sm font-medium mb-2 ${
              isDark ? "text-blue-300" : "text-blue-800"
            }`}
          >
            We found content from AI Content Writer{isAlreadyImported ? " (already imported)" : ""}
          </div>
          {importItems.length > 0 && (
            <div className="mb-2">
              <ul className={`text-xs list-disc list-inside space-y-0.5 ${
                isDark ? "text-blue-400" : "text-blue-700"
              }`}>
                {importItems.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {isAlreadyImported && (
            <div
              className={`text-xs ${
                isDark ? "text-blue-400" : "text-blue-700"
              }`}
            >
              This handoff was already imported in this session.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onImport}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDark
                ? "bg-[#29c4a9] text-white hover:bg-[#22ad93] focus:ring-[#29c4a9]"
                : "bg-[#29c4a9] text-white hover:bg-[#22ad93] focus:ring-[#29c4a9]"
            }`}
            aria-label="Review and import content from AI Content Writer"
          >
            Review & Import
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

