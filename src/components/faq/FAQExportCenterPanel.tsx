"use client";

import { useState } from "react";
import {
  formatFAQsPlainText,
  formatFAQsMarkdown,
  formatFAQsHtml,
  formatFAQsJsonLd,
  formatFAQsDivi,
  type FAQItem,
} from "@/app/apps/faq-generator/faq-export-formatters";
import { getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";
import FAQHelpDeskImportModal from "./FAQHelpDeskImportModal";
import FAQNextStepsPanel from "./FAQNextStepsPanel";

interface FAQExportCenterPanelProps {
  faqs: FAQItem[];
  isDark: boolean;
  onValidationError: (message: string) => void;
  getActiveFaqs: () => FAQItem[];
  resolvedBusinessId: string | null;
  businessName: string;
  businessType: string;
  topic: string;
  services: string;
}

/**
 * Validate FAQs before export
 * Returns error message if validation fails, null if valid
 */
export function validateFAQsForExport(faqs: FAQItem[]): string | null {
  if (faqs.length === 0) {
    return "No FAQs available. Generate FAQs first.";
  }

  const emptyItems = faqs.filter((faq) => !faq.question.trim() || !faq.answer.trim());
  if (emptyItems.length > 0) {
    const itemNumbers = emptyItems.map((faq) => faq.number).join(", ");
    return `FAQ${emptyItems.length > 1 ? "s" : ""} ${itemNumbers} ${emptyItems.length > 1 ? "have" : "has"} empty question or answer. Please edit or delete these items before exporting.`;
  }

  return null;
}

export default function FAQExportCenterPanel({
  faqs,
  isDark,
  onValidationError,
  getActiveFaqs,
  resolvedBusinessId,
  businessName,
  businessType,
  topic,
  services,
}: FAQExportCenterPanelProps) {
  const [copiedItems, setCopiedItems] = useState<Record<string, string>>({});
  const [showImportModal, setShowImportModal] = useState(false);

  // Handoff utility functions (reused from Help Desk pattern)
  const encodeBase64Url = (data: string): string => {
    const utf8Bytes = new TextEncoder().encode(data);
    let binary = "";
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const generateHandoffId = (): string => {
    return `handoff_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const storeHandoffPayload = (payload: unknown, targetRoute: string): void => {
    const jsonString = JSON.stringify(payload);
    const encoded = encodeBase64Url(jsonString);
    const urlParam = `?handoff=${encoded}`;

    // Try URL handoff if encoded length is reasonable (~1500 chars for base64url)
    if (encoded.length <= 1500) {
      // Navigate to target route with query param
      const targetUrl = `${targetRoute}${urlParam}`;
      window.location.href = targetUrl;
    } else {
      // Fallback to localStorage
      const handoffId = generateHandoffId();
      const storageKey = `obd_handoff:${handoffId}`;
      
      try {
        localStorage.setItem(storageKey, jsonString);
        // Navigate with handoffId
        const targetUrl = `${targetRoute}?handoffId=${handoffId}`;
        window.location.href = targetUrl;
      } catch (error) {
        console.error("Failed to store handoff payload:", error);
        onValidationError("Failed to send handoff. Please try again.");
      }
    }
  };

  const handleSendToSchemaGenerator = () => {
    const activeFaqs = getActiveFaqs();
    const validationError = validateFAQsForExport(activeFaqs);
    if (validationError) {
      onValidationError(validationError);
      return;
    }

    // Create payload
    const title = topic
      ? `FAQPage Schema: ${topic}`
      : businessName
      ? `FAQPage Schema: ${businessName}`
      : "FAQPage Schema";

    const jsonLd = formatFAQsJsonLd(activeFaqs);

    const payload = {
      sourceApp: "ai-faq-generator",
      type: "faqpage-jsonld",
      title,
      jsonLd,
      context: {
        businessName: businessName || "",
        businessType: businessType || "",
        topic: topic || "",
      },
    };

    try {
      storeHandoffPayload(payload, "/apps/business-schema-generator");
    } catch (error) {
      onValidationError("Failed to send to Schema Generator. Please try again.");
    }
  };

  const handleSendToContentWriter = () => {
    const activeFaqs = getActiveFaqs();
    const validationError = validateFAQsForExport(activeFaqs);
    if (validationError) {
      onValidationError(validationError);
      return;
    }

    // Create payload
    const title = topic
      ? `FAQ Section: ${topic}`
      : businessName
      ? `FAQ Section: ${businessName}`
      : "FAQ Section";

    const payload = {
      sourceApp: "ai-faq-generator",
      type: "faq-section",
      title,
      markdown: formatFAQsMarkdown(activeFaqs),
      html: formatFAQsHtml(activeFaqs),
      divi: formatFAQsDivi(activeFaqs),
      context: {
        businessName: businessName || "",
        businessType: businessType || "",
        topic: topic || "",
        services: services || "",
      },
    };

    try {
      storeHandoffPayload(payload, "/apps/content-writer");
    } catch (error) {
      onValidationError("Failed to send to Content Writer. Please try again.");
    }
  };

  const handleSendToHelpDesk = () => {
    const activeFaqs = getActiveFaqs();
    const validationError = validateFAQsForExport(activeFaqs);
    if (validationError) {
      onValidationError(validationError);
      return;
    }

    if (typeof window === "undefined") {
      onValidationError("Unable to send handoff in this environment.");
      return;
    }

    const now = Date.now();
    const ttlMs = 10 * 60 * 1000; // 10 minutes

    const envelope = {
      v: 1 as const,
      payloadVersion: 1 as const,
      sourceApp: "ai-faq-generator" as const,
      createdAt: now,
      expiresAt: now + ttlMs,
      businessId: resolvedBusinessId,
      faqs: activeFaqs.map((faq, idx) => ({
        id: `faq-${faq.number ?? idx + 1}`,
        question: faq.question,
        answer: faq.answer,
      })),
    };

    try {
      sessionStorage.setItem("obd:ai-help-desk:handoff:faq-generator", JSON.stringify(envelope));
      window.location.href = "/apps/ai-help-desk";
    } catch (error) {
      console.error("Failed to write Help Desk handoff:", error);
      onValidationError("Failed to send to Help Desk. Please try again.");
    }
  };

  const handleCopy = async (itemId: string, content: string) => {
    // Validate before copying
    const validationError = validateFAQsForExport(faqs);
    if (validationError) {
      onValidationError(validationError);
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
    } catch (error) {
      console.error("Failed to copy:", error);
      onValidationError("Failed to copy to clipboard. Please try again.");
    }
  };

  // Check if FAQs are valid for export
  const validationError = validateFAQsForExport(faqs);
  const canExport = validationError === null;

  return (
    <div className="space-y-6">
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Export Formats
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleCopy("export-plain-text", formatFAQsPlainText(faqs))}
            disabled={!canExport}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              copiedItems["export-plain-text"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-plain-text"] ? "Copied!" : "Copy as Plain Text"}
          </button>
          <button
            onClick={() => handleCopy("export-markdown", formatFAQsMarkdown(faqs))}
            disabled={!canExport}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              copiedItems["export-markdown"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-markdown"] ? "Copied!" : "Copy as Markdown"}
          </button>
          <button
            onClick={() => handleCopy("export-html", formatFAQsHtml(faqs))}
            disabled={!canExport}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              copiedItems["export-html"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-html"] ? "Copied!" : "Copy as HTML"}
          </button>
          <button
            onClick={() => handleCopy("export-jsonld", formatFAQsJsonLd(faqs))}
            disabled={!canExport}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              copiedItems["export-jsonld"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-jsonld"] ? "Copied!" : "Copy as JSON-LD"}
          </button>
          <button
            onClick={() => handleCopy("export-divi", formatFAQsDivi(faqs))}
            disabled={!canExport}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              copiedItems["export-divi"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-divi"] ? "Copied!" : "Copy for Divi"}
          </button>
        </div>
      </div>

      {/* Send to AI Help Desk */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          AI Help Desk Integration
        </h4>
        <button
          onClick={handleSendToHelpDesk}
          disabled={!canExport}
          className={getSecondaryButtonClasses(isDark) + " disabled:opacity-50 disabled:cursor-not-allowed"}
        >
          Send to Help Desk
        </button>
      </div>

      {/* Send to Schema Generator */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Schema Generator Integration
        </h4>
        <button
          onClick={handleSendToSchemaGenerator}
          disabled={!canExport}
          className={getSecondaryButtonClasses(isDark) + " disabled:opacity-50 disabled:cursor-not-allowed"}
        >
          Send to Schema Generator
        </button>
      </div>

      {/* Send to AI Content Writer */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Content Writer Integration
        </h4>
        <button
          onClick={handleSendToContentWriter}
          disabled={!canExport}
          className={getSecondaryButtonClasses(isDark) + " disabled:opacity-50 disabled:cursor-not-allowed"}
        >
          Send to AI Content Writer
        </button>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <FAQHelpDeskImportModal
          faqs={getActiveFaqs()}
          isDark={isDark}
          businessName={businessName}
          businessType={businessType}
          topic={topic}
          onClose={() => setShowImportModal(false)}
          onValidationError={onValidationError}
        />
      )}

      {/* Next Steps Panel */}
      <FAQNextStepsPanel
        faqs={faqs}
        isDark={isDark}
        getActiveFaqs={getActiveFaqs}
        onOpenHelpDeskModal={() => {
          const activeFaqs = getActiveFaqs();
          const validationError = validateFAQsForExport(activeFaqs);
          if (validationError) {
            onValidationError(validationError);
            return;
          }
          setShowImportModal(true);
        }}
        onSendToSchemaGenerator={handleSendToSchemaGenerator}
        onSendToContentWriter={handleSendToContentWriter}
        onValidationError={onValidationError}
      />
    </div>
  );
}

