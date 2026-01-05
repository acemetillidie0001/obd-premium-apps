"use client";

import { useState, useEffect } from "react";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";
import type { CaptionItem } from "@/app/apps/image-caption-generator/types";

interface CaptionNextStepsPanelProps {
  activeCaptions: CaptionItem[];
  selectedCaptionIds: Set<string>;
  isDark: boolean;
  onSendToSocialAutoPoster: () => void;
}

const DISMISS_KEY = "tier5c-image-caption-generator-next-steps";

export default function CaptionNextStepsPanel({
  activeCaptions,
  selectedCaptionIds,
  isDark,
  onSendToSocialAutoPoster,
}: CaptionNextStepsPanelProps) {
  const themeClasses = getThemeClasses(isDark);
  const [isDismissed, setIsDismissed] = useState(true); // Start dismissed, check in useEffect

  // Check sessionStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      const wasDismissed = sessionStorage.getItem(DISMISS_KEY) === "true";
      setIsDismissed(wasDismissed);
    } catch (error) {
      // Fail silently if sessionStorage is unavailable
      console.warn("Failed to check dismissal state:", error);
      setIsDismissed(false);
    }
  }, []);

  // Handle dismiss
  const handleDismiss = () => {
    if (typeof window === "undefined") return;
    
    try {
      sessionStorage.setItem(DISMISS_KEY, "true");
      setIsDismissed(true);
    } catch (error) {
      // Fail silently if sessionStorage is unavailable
      console.warn("Failed to store dismissal:", error);
      setIsDismissed(true); // Still hide the panel
    }
  };

  // Don't render if dismissed or no captions
  if (isDismissed || activeCaptions.length === 0) {
    return null;
  }

  const captionCount = selectedCaptionIds.size > 0 
    ? selectedCaptionIds.size 
    : activeCaptions.length;
  const canSend = activeCaptions.length > 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        isDark
          ? "bg-slate-800/50 border-slate-700"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      {/* Header with dismiss button */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4
            className={`text-sm font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Next Steps
          </h4>
          <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
            Use your captions across the OBD ecosystem
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 p-1 rounded transition-colors ${
            isDark
              ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
          }`}
          aria-label="Dismiss"
          type="button"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Social Auto-Poster action */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <button
            onClick={onSendToSocialAutoPoster}
            disabled={!canSend}
            className={`text-left text-sm font-medium transition-colors ${
              canSend
                ? isDark
                  ? "text-slate-200 hover:text-white"
                  : "text-slate-700 hover:text-slate-900"
                : isDark
                ? "text-slate-500 cursor-not-allowed"
                : "text-slate-400 cursor-not-allowed"
            }`}
          >
            Send to Social Auto-Poster
          </button>
          {!canSend && (
            <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
              Generate captions to send
            </p>
          )}
          {canSend && (
            <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
              {selectedCaptionIds.size > 0
                ? `Sending ${captionCount} selected caption${captionCount !== 1 ? "s" : ""}`
                : `Sending ${captionCount} caption${captionCount !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>
        <button
          onClick={onSendToSocialAutoPoster}
          disabled={!canSend}
          className={getSecondaryButtonClasses(isDark) + " disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"}
          title={!canSend ? "Generate captions to send" : undefined}
        >
          Send
        </button>
      </div>
    </div>
  );
}

