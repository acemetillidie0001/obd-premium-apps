"use client";

import { useState } from "react";
import {
  formatFullPackPlainText,
  formatGBPPackPlainText,
  formatWebsitePackPlainText,
  type BusinessDescriptionResponseExport as BusinessDescriptionResponse,
} from "@/lib/bdw";

interface CopyBundlesProps {
  result: BusinessDescriptionResponse;
  isDark: boolean;
}

export default function CopyBundles({ result, isDark }: CopyBundlesProps) {
  const [copiedBundle, setCopiedBundle] = useState<string | null>(null);

  const handleCopy = async (bundleId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedBundle(bundleId);
      setTimeout(() => {
        setCopiedBundle(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
      <div className="flex flex-wrap gap-3 items-center">
        <span className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-700"}`}>
          Copy Bundles:
        </span>
        <button
          onClick={() => handleCopy("gbp", formatGBPPackPlainText(result))}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            copiedBundle === "gbp"
              ? isDark
                ? "bg-[#29c4a9] text-white"
                : "bg-[#29c4a9] text-white"
              : isDark
              ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
              : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
          }`}
        >
          {copiedBundle === "gbp" ? "Copied!" : "Copy GBP Bundle"}
        </button>
        <button
          onClick={() => handleCopy("website", formatWebsitePackPlainText(result))}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            copiedBundle === "website"
              ? isDark
                ? "bg-[#29c4a9] text-white"
                : "bg-[#29c4a9] text-white"
              : isDark
              ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
              : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
          }`}
        >
          {copiedBundle === "website" ? "Copied!" : "Copy Website Bundle"}
        </button>
        <button
          onClick={() => handleCopy("full", formatFullPackPlainText(result))}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            copiedBundle === "full"
              ? isDark
                ? "bg-[#29c4a9] text-white"
                : "bg-[#29c4a9] text-white"
              : isDark
              ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
              : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
          }`}
        >
          {copiedBundle === "full" ? "Copied!" : "Copy Full Marketing Pack"}
        </button>
      </div>
    </div>
  );
}

