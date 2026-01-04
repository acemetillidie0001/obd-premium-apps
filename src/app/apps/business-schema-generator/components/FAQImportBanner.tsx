"use client";

interface FAQImportBannerProps {
  isDark: boolean;
  isAlreadyImported: boolean;
  onInsert: () => void;
  onDismiss: () => void;
}

export default function FAQImportBanner({
  isDark,
  isAlreadyImported,
  onInsert,
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
            FAQPage schema received from AI FAQ Generator{isAlreadyImported ? " (already imported)" : ""}
          </div>
          {isAlreadyImported && (
            <div
              className={`text-xs ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              This handoff was already imported in this session.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onInsert}
            disabled={isAlreadyImported}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isAlreadyImported
                ? isDark
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                : isDark
                ? "bg-[#29c4a9] text-white hover:bg-[#22ad93]"
                : "bg-[#29c4a9] text-white hover:bg-[#22ad93]"
            }`}
          >
            Insert
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

