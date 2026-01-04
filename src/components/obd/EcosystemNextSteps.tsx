"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";

export type EcosystemStepId = "faq" | "schema" | "helpdesk" | "content" | "website-draft";

export interface EcosystemStep {
  id: EcosystemStepId;
  label: string;
  description: string;
  href: string;
  cta: string;
}

export interface EcosystemNextStepsProps {
  title: string;
  description?: string;
  steps: EcosystemStep[];
  dismissKey: string;
  isDark?: boolean;
}

/**
 * EcosystemNextSteps - Tier 5C component for ecosystem flow polish
 * 
 * A reusable, dismissible panel that shows next steps for using content across
 * the OBD ecosystem. Fully presentational with sessionStorage-based dismissal.
 * 
 * @example
 * <EcosystemNextSteps
 *   title="Next Steps"
 *   description="Use your content across the OBD ecosystem"
 *   steps={[
 *     {
 *       id: "faq",
 *       label: "FAQ Generator",
 *       description: "Generate FAQs from your content",
 *       href: "/apps/faq-generator",
 *       cta: "Go to FAQ Generator"
 *     }
 *   ]}
 *   dismissKey="ecosystem-next-steps-faq"
 *   isDark={isDark}
 * />
 */
export default function EcosystemNextSteps({
  title,
  description,
  steps,
  dismissKey,
  isDark = false,
}: EcosystemNextStepsProps) {
  const themeClasses = getThemeClasses(isDark);
  const [isDismissed, setIsDismissed] = useState(true); // Start dismissed, check in useEffect

  // Check sessionStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      const wasDismissed = sessionStorage.getItem(dismissKey) === "true";
      setIsDismissed(wasDismissed);
    } catch (error) {
      // Fail silently if sessionStorage is unavailable
      console.warn("Failed to check dismissal state:", error);
      setIsDismissed(false);
    }
  }, [dismissKey]);

  // Handle dismiss
  const handleDismiss = () => {
    if (typeof window === "undefined") return;
    
    try {
      sessionStorage.setItem(dismissKey, "true");
      setIsDismissed(true);
    } catch (error) {
      // Fail silently if sessionStorage is unavailable
      console.warn("Failed to store dismissal:", error);
      setIsDismissed(true); // Still hide the panel
    }
  };

  // Don't render if dismissed
  if (isDismissed) {
    return null;
  }

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
            {title}
          </h4>
          {description && (
            <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
              {description}
            </p>
          )}
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

      {/* Steps list */}
      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex items-start justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-700"
                }`}
              >
                {step.label}
              </div>
              <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                {step.description}
              </p>
            </div>
            <Link
              href={step.href}
              className={getSecondaryButtonClasses(isDark) + " flex-shrink-0"}
            >
              {step.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

