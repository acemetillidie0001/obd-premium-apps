"use client";

import { useState } from "react";

export interface ResultCardProps {
  title: string;
  children: React.ReactNode;
  isDark: boolean;
  copyText?: string; // If provided, shows copy button
}

/**
 * ResultCard - Shared component for displaying result sections with optional copy-to-clipboard functionality.
 * 
 * Used across V3 apps (Event Campaign Builder, Offers Builder, etc.) to display
 * generated content in a consistent card format.
 * 
 * Features:
 * - Optional title
 * - Copy-to-clipboard button (if copyText provided)
 * - "Copied!" feedback (2 seconds)
 * - Theme-aware styling
 * 
 * @example
 * ```tsx
 * <ResultCard
 *   title="Event Titles"
 *   isDark={isDark}
 *   copyText={titles.join("\n")}
 * >
 *   {titles.map((title) => <p key={title}>{title}</p>)}
 * </ResultCard>
 * ```
 */
export default function ResultCard({
  title,
  children,
  isDark,
  copyText,
}: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("ResultCard Copy Error:", error);
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 ${
        isDark
          ? "bg-slate-800/50 border-slate-700"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      {(title || copyText) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <h3
              className={`text-sm font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {title}
            </h3>
          )}
          {copyText && (
            <button
              onClick={handleCopy}
              className={`text-xs px-2 py-1 rounded transition-colors ml-auto ${
                copied
                  ? "bg-[#29c4a9] text-white"
                  : isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
      )}
      <div className={`text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
        {children}
      </div>
    </div>
  );
}
