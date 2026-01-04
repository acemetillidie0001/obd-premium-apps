"use client";

import { getThemeClasses } from "@/lib/obd-framework/theme";
import { getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";
import type { FAQItem } from "@/app/apps/faq-generator/faq-export-formatters";
import { validateFAQsForExport } from "./FAQExportCenterPanel";

interface FAQNextStepsPanelProps {
  faqs: FAQItem[];
  isDark: boolean;
  getActiveFaqs: () => FAQItem[];
  onOpenHelpDeskModal: () => void;
  onSendToSchemaGenerator: () => void;
  onSendToContentWriter: () => void;
  onValidationError: (message: string) => void;
}

export default function FAQNextStepsPanel({
  faqs,
  isDark,
  getActiveFaqs,
  onOpenHelpDeskModal,
  onSendToSchemaGenerator,
  onSendToContentWriter,
  onValidationError,
}: FAQNextStepsPanelProps) {
  const themeClasses = getThemeClasses(isDark);
  
  // Check if FAQs exist
  const hasFaqs = faqs.length > 0;
  
  // Validate FAQs for export
  const validationError = validateFAQsForExport(faqs);
  const canExport = validationError === null;
  
  // Helper to handle action with validation
  const handleAction = (action: () => void) => {
    if (!canExport) {
      onValidationError(validationError || "FAQs are not ready for export.");
      return;
    }
    action();
  };

  return (
    <div
      className={`rounded-xl border p-4 ${
        isDark
          ? "bg-slate-800/50 border-slate-700"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <h4
        className={`text-sm font-semibold mb-3 ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        Next Steps
      </h4>
      <p
        className={`text-xs mb-4 ${themeClasses.mutedText}`}
      >
        Use your FAQs across the OBD ecosystem
      </p>

      <div className="space-y-3">
        {/* AI Help Desk */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <button
              onClick={() => handleAction(onOpenHelpDeskModal)}
              disabled={!canExport}
              className={`text-left text-sm font-medium transition-colors ${
                canExport
                  ? isDark
                    ? "text-slate-200 hover:text-white"
                    : "text-slate-700 hover:text-slate-900"
                  : isDark
                  ? "text-slate-500 cursor-not-allowed"
                  : "text-slate-400 cursor-not-allowed"
              }`}
            >
              Add these FAQs to your AI Help Desk
            </button>
            {!canExport && (
              <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                {hasFaqs
                  ? "Fix empty questions or answers to enable"
                  : "Generate FAQs first"}
              </p>
            )}
          </div>
          <button
            onClick={() => handleAction(onOpenHelpDeskModal)}
            disabled={!canExport}
            className={getSecondaryButtonClasses(isDark) + " disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"}
          >
            Add
          </button>
        </div>

        {/* Schema Generator */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <button
              onClick={() => handleAction(onSendToSchemaGenerator)}
              disabled={!canExport}
              className={`text-left text-sm font-medium transition-colors ${
                canExport
                  ? isDark
                    ? "text-slate-200 hover:text-white"
                    : "text-slate-700 hover:text-slate-900"
                  : isDark
                  ? "text-slate-500 cursor-not-allowed"
                  : "text-slate-400 cursor-not-allowed"
              }`}
            >
              Add FAQPage schema in Schema Generator
            </button>
            {!canExport && (
              <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                {hasFaqs
                  ? "Fix empty questions or answers to enable"
                  : "Generate FAQs first"}
              </p>
            )}
          </div>
          <button
            onClick={() => handleAction(onSendToSchemaGenerator)}
            disabled={!canExport}
            className={getSecondaryButtonClasses(isDark) + " disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"}
          >
            Send
          </button>
        </div>

        {/* Content Writer */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <button
              onClick={() => handleAction(onSendToContentWriter)}
              disabled={!canExport}
              className={`text-left text-sm font-medium transition-colors ${
                canExport
                  ? isDark
                    ? "text-slate-200 hover:text-white"
                    : "text-slate-700 hover:text-slate-900"
                  : isDark
                  ? "text-slate-500 cursor-not-allowed"
                  : "text-slate-400 cursor-not-allowed"
              }`}
            >
              Use these FAQs in AI Content Writer
            </button>
            {!canExport && (
              <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                {hasFaqs
                  ? "Fix empty questions or answers to enable"
                  : "Generate FAQs first"}
              </p>
            )}
          </div>
          <button
            onClick={() => handleAction(onSendToContentWriter)}
            disabled={!canExport}
            className={getSecondaryButtonClasses(isDark) + " disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

