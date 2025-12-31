/**
 * CRM Integration Indicator Component
 * 
 * Standardized component for showing CRM context and back link across integrated apps.
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import { isValidReturnUrl } from "@/lib/utils/crm-integration-helpers";

interface CrmIntegrationIndicatorProps {
  isDark: boolean;
  showContextPill?: boolean;
  showBackLink?: boolean;
  returnUrl?: string | null;
  onDismissContext?: () => void;
}

/**
 * Standardized CRM Integration Indicator
 * 
 * Shows:
 * - "CRM context loaded" dismissible pill (when showContextPill is true)
 * - "← Back to CRM Contact" link (when showBackLink is true and returnUrl is valid)
 */
export function CrmIntegrationIndicator({
  isDark,
  showContextPill = false,
  showBackLink = false,
  returnUrl = null,
  onDismissContext,
}: CrmIntegrationIndicatorProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismissContext) {
      onDismissContext();
    }
  };

  const validReturnUrl = returnUrl && isValidReturnUrl(returnUrl);

  return (
    <>
      {/* Back Link */}
      {showBackLink && validReturnUrl && (
        <div className="mb-4">
          <Link
            href={returnUrl}
            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
              isDark
                ? "text-blue-400 hover:text-blue-300"
                : "text-blue-600 hover:text-blue-700"
            }`}
          >
            ← Back to CRM Contact
          </Link>
        </div>
      )}

      {/* CRM Context Pill */}
      {showContextPill && !dismissed && (
        <div
          className={`mb-4 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 ${
            isDark
              ? "bg-blue-900/30 text-blue-300 border border-blue-700/50"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}
        >
          <span>CRM context loaded</span>
          <button
            type="button"
            onClick={handleDismiss}
            className="ml-auto hover:opacity-70"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

