"use client";

import { useState } from "react";
import OBDPanel from "@/components/obd/OBDPanel";
import { isDismissed, dismiss } from "@/lib/apps/social-auto-poster/ui/dismissKeys";

interface SessionCalloutProps {
  dismissKey: string;
  title: string;
  message: string;
  isDark: boolean;
  customContent?: React.ReactNode;
  onDismiss?: () => void; // Optional callback when dismissed
}

/**
 * SessionCallout Component
 * 
 * Lightweight, dismissible callout that appears only once per session.
 * Uses sessionStorage to track dismissal state.
 */
export default function SessionCallout({
  dismissKey,
  title,
  message,
  isDark,
  customContent,
  onDismiss,
}: SessionCalloutProps) {
  const [isVisible, setIsVisible] = useState(() => {
    // Check if already dismissed on mount
    return !isDismissed(dismissKey);
  });

  const handleDismiss = () => {
    dismiss(dismissKey);
    setIsVisible(false);
    // Call optional onDismiss callback
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!isVisible) return null;

  const themeClasses = {
    text: isDark ? "text-slate-200" : "text-slate-900",
    muted: isDark ? "text-slate-400" : "text-slate-600",
    button: isDark
      ? "text-slate-400 hover:text-slate-300"
      : "text-slate-600 hover:text-slate-800",
  };

  return (
    <OBDPanel isDark={isDark} className="mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className={`text-sm font-medium mb-1 ${themeClasses.text}`}>
            {title}
          </h4>
          <p className={`text-sm ${themeClasses.muted}`}>
            {message}
          </p>
          {customContent && <div>{customContent}</div>}
        </div>
        <button
          onClick={handleDismiss}
          className={`text-sm font-medium transition-colors flex-shrink-0 ${themeClasses.button}`}
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
    </OBDPanel>
  );
}

