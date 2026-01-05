"use client";

import { useState } from "react";
import { formatCaptionsPlain, formatCaptionsCsv } from "@/lib/apps/image-caption-generator/caption-export-formatters";
import type { CaptionItem } from "@/app/apps/image-caption-generator/types";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { getSubtleButtonSmallClasses } from "@/lib/obd-framework/layout-helpers";

interface CaptionExportCenterPanelProps {
  captions: CaptionItem[];
  isDark: boolean;
  onToast: (message: string) => void;
}

/**
 * CaptionExportCenterPanel - Export center for image captions
 * 
 * Provides export options: Plain Text, Platform Blocks, and CSV
 * with copy and download actions.
 */
export default function CaptionExportCenterPanel({
  captions,
  isDark,
  onToast,
}: CaptionExportCenterPanelProps) {
  const themeClasses = getThemeClasses(isDark);
  const [copiedItems, setCopiedItems] = useState<Record<string, string>>({});

  const canExport = captions.length > 0;

  const handleCopy = async (itemId: string, content: string, formatName: string) => {
    if (!canExport) {
      onToast("No captions to export");
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopiedItems((prev) => ({ ...prev, [itemId]: itemId }));
      setTimeout(() => {
        setCopiedItems((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }, 2000);
      onToast("Copied export");
    } catch (error) {
      console.error("Failed to copy:", error);
      onToast("Failed to copy to clipboard");
    }
  };

  const handleDownload = (filename: string, content: string, formatName: string) => {
    if (!canExport) {
      onToast("No captions to export");
      return;
    }

    try {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (formatName === "captions.txt") {
        onToast("Downloaded captions.txt");
      } else if (formatName === "captions.csv") {
        onToast("Downloaded captions.csv");
      } else {
        onToast(`Downloaded ${formatName}`);
      }
    } catch (error) {
      console.error("Failed to download:", error);
      onToast("Failed to download file");
    }
  };

  const plainText = formatCaptionsPlain(captions);
  const csvText = formatCaptionsCsv(captions);

  return (
    <div className="space-y-4">
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Export Formats
        </h4>
        <div className="space-y-3">
          {/* Plain Text */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center justify-between mb-2">
              <h5 className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                Plain Text
              </h5>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy("export-plain-text", plainText, "Plain Text")}
                  disabled={!canExport}
                  className={`${getSubtleButtonSmallClasses(isDark)} ${
                    !canExport ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {copiedItems["export-plain-text"] ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => handleDownload("captions.txt", plainText, "captions.txt")}
                  disabled={!canExport}
                  className={`${getSubtleButtonSmallClasses(isDark)} ${
                    !canExport ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Download
                </button>
              </div>
            </div>
            <p className={`text-xs ${themeClasses.mutedText}`}>
              Platform-grouped text format with headers
            </p>
          </div>

          {/* Platform Blocks (same as Plain Text) */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center justify-between mb-2">
              <h5 className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                Platform Blocks
              </h5>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy("export-platform-blocks", plainText, "Platform Blocks")}
                  disabled={!canExport}
                  className={`${getSubtleButtonSmallClasses(isDark)} ${
                    !canExport ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {copiedItems["export-platform-blocks"] ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => handleDownload("captions.txt", plainText, "captions.txt")}
                  disabled={!canExport}
                  className={`${getSubtleButtonSmallClasses(isDark)} ${
                    !canExport ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Download
                </button>
              </div>
            </div>
            <p className={`text-xs ${themeClasses.mutedText}`}>
              Same as Plain Text format
            </p>
          </div>

          {/* CSV */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center justify-between mb-2">
              <h5 className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                CSV
              </h5>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy("export-csv", csvText, "CSV")}
                  disabled={!canExport}
                  className={`${getSubtleButtonSmallClasses(isDark)} ${
                    !canExport ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {copiedItems["export-csv"] ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => handleDownload("captions.csv", csvText, "captions.csv")}
                  disabled={!canExport}
                  className={`${getSubtleButtonSmallClasses(isDark)} ${
                    !canExport ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Download
                </button>
              </div>
            </div>
            <p className={`text-xs ${themeClasses.mutedText}`}>
              CSV format with headers: caption, platform, goal, hashtags
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

