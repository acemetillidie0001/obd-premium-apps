"use client";

import { useState } from "react";
import type { FAQItem } from "@/app/apps/faq-generator/faq-export-formatters";
import { validateFAQsForExport } from "./FAQExportCenterPanel";
import { getSecondaryButtonClasses, SUBMIT_BUTTON_CLASSES } from "@/lib/obd-framework/layout-helpers";

interface FAQHelpDeskImportModalProps {
  faqs: FAQItem[];
  isDark: boolean;
  businessName: string;
  businessType: string;
  topic: string;
  onClose: () => void;
  onValidationError: (message: string) => void;
}

type ImportMode = "qa" | "doc";

interface HelpDeskHandoffPayload {
  sourceApp: "ai-faq-generator";
  importedAt: string;
  mode: ImportMode;
  title: string;
  items: Array<{ question: string; answer: string }>;
  businessContext: {
    businessName: string;
    businessType: string;
    topic: string;
  };
}

/**
 * Encode payload to base64url-safe string
 * Handles Unicode characters properly
 */
function encodeBase64Url(data: string): string {
  // Convert to UTF-8 bytes, then to base64
  const utf8Bytes = new TextEncoder().encode(data);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generate a unique ID for localStorage handoff
 */
function generateHandoffId(): string {
  return `handoff_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Store payload via handoff mechanism
 * First attempts URL query param (if <= ~1500 chars), falls back to localStorage
 */
function storeHandoffPayload(payload: HelpDeskHandoffPayload): void {
  const jsonString = JSON.stringify(payload);
  const encoded = encodeBase64Url(jsonString);
  const urlParam = `?handoff=${encoded}`;

  // Try URL handoff if encoded length is reasonable (~1500 chars for base64url)
  if (encoded.length <= 1500) {
    // Navigate to AI Help Desk with query param
    const helpDeskUrl = `/apps/ai-help-desk${urlParam}`;
    window.location.href = helpDeskUrl;
  } else {
    // Fallback to localStorage
    const handoffId = generateHandoffId();
    const storageKey = `obd_handoff:${handoffId}`;
    
    try {
      localStorage.setItem(storageKey, jsonString);
      // Navigate with handoffId
      const helpDeskUrl = `/apps/ai-help-desk?handoffId=${handoffId}`;
      window.location.href = helpDeskUrl;
    } catch (error) {
      console.error("Failed to store handoff payload:", error);
      throw new Error("Failed to store import data. Please try again.");
    }
  }
}

export default function FAQHelpDeskImportModal({
  faqs,
  isDark,
  businessName,
  businessType,
  topic,
  onClose,
  onValidationError,
}: FAQHelpDeskImportModalProps) {
  const [importMode, setImportMode] = useState<ImportMode>("qa");

  const handleConfirm = () => {
    // Validate FAQs
    const validationError = validateFAQsForExport(faqs);
    if (validationError) {
      onValidationError(validationError);
      return;
    }

    // Create normalized payload
    const title = topic
      ? `FAQs: ${topic}`
      : businessName
      ? `FAQs: ${businessName}`
      : "FAQs";

    const payload: HelpDeskHandoffPayload = {
      sourceApp: "ai-faq-generator",
      importedAt: new Date().toISOString(),
      mode: importMode,
      title,
      items: faqs.map((faq) => ({
        question: faq.question,
        answer: faq.answer,
      })),
      businessContext: {
        businessName: businessName || "",
        businessType: businessType || "",
        topic: topic || "",
      },
    };

    try {
      storeHandoffPayload(payload);
      // Modal will close when navigation happens
    } catch (error) {
      onValidationError(error instanceof Error ? error.message : "Failed to import FAQs");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl pointer-events-auto ${
            isDark
              ? "bg-slate-800 border border-slate-700"
              : "bg-white border border-slate-200"
          }`}
        >
          {/* Header */}
          <div
            className={`sticky top-0 px-6 py-4 border-b ${
              isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Add to AI Help Desk Knowledge
              </h3>
              <button
                onClick={onClose}
                className={`text-2xl leading-none ${
                  isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"
                }`}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Preview */}
            <div>
              <h4
                className={`text-sm font-semibold mb-3 ${
                  isDark ? "text-slate-200" : "text-slate-700"
                }`}
              >
                Preview ({faqs.length} FAQ{faqs.length !== 1 ? "s" : ""})
              </h4>
              <div
                className={`max-h-64 overflow-y-auto rounded-lg border p-4 space-y-3 ${
                  isDark
                    ? "bg-slate-900/50 border-slate-700"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                {faqs.map((faq, index) => (
                  <div
                    key={index}
                    className={`pb-3 ${
                      index < faqs.length - 1
                        ? isDark
                          ? "border-b border-slate-700"
                          : "border-b border-slate-200"
                        : ""
                    }`}
                  >
                    <p
                      className={`font-medium mb-1 ${
                        isDark ? "text-slate-200" : "text-slate-800"
                      }`}
                    >
                      Q: {faq.question}
                    </p>
                    <p
                      className={`text-sm ${
                        isDark ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      A: {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Import Mode Selector */}
            <div>
              <h4
                className={`text-sm font-semibold mb-3 ${
                  isDark ? "text-slate-200" : "text-slate-700"
                }`}
              >
                Import Mode
              </h4>
              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                    importMode === "qa"
                      ? isDark
                        ? "bg-slate-700 border-[#29c4a9]"
                        : "bg-slate-50 border-[#29c4a9]"
                      : isDark
                      ? "bg-slate-900/50 border-slate-700 hover:bg-slate-800"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="qa"
                    checked={importMode === "qa"}
                    onChange={(e) => setImportMode(e.target.value as ImportMode)}
                    className="w-4 h-4 text-[#29c4a9] focus:ring-[#29c4a9]"
                  />
                  <div>
                    <div
                      className={`font-medium ${
                        isDark ? "text-slate-200" : "text-slate-800"
                      }`}
                    >
                      Import as individual Q&A entries
                    </div>
                    <div
                      className={`text-xs mt-1 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Each question and answer will be added as a separate knowledge entry
                    </div>
                  </div>
                </label>
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                    importMode === "doc"
                      ? isDark
                        ? "bg-slate-700 border-[#29c4a9]"
                        : "bg-slate-50 border-[#29c4a9]"
                      : isDark
                      ? "bg-slate-900/50 border-slate-700 hover:bg-slate-800"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="doc"
                    checked={importMode === "doc"}
                    onChange={(e) => setImportMode(e.target.value as ImportMode)}
                    className="w-4 h-4 text-[#29c4a9] focus:ring-[#29c4a9]"
                  />
                  <div>
                    <div
                      className={`font-medium ${
                        isDark ? "text-slate-200" : "text-slate-800"
                      }`}
                    >
                      Import as a single FAQ document
                    </div>
                    <div
                      className={`text-xs mt-1 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      All FAQs will be combined into one knowledge document
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Microcopy */}
            <div
              className={`rounded-lg p-3 text-sm ${
                isDark
                  ? "bg-slate-900/50 text-slate-300"
                  : "bg-slate-50 text-slate-600"
              }`}
            >
              This will add content to your AI Help Desk knowledge for this business. Nothing is published until you confirm.
            </div>
          </div>

          {/* Footer */}
          <div
            className={`sticky bottom-0 px-6 py-4 border-t flex gap-3 justify-end ${
              isDark
                ? "border-slate-700 bg-slate-800"
                : "border-slate-200 bg-white"
            }`}
          >
            <button
              onClick={onClose}
              className={getSecondaryButtonClasses(isDark)}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={SUBMIT_BUTTON_CLASSES}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

