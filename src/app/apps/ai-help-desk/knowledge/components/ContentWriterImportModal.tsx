"use client";

import { useState } from "react";
import type { ContentWriterHandoffPayload } from "@/lib/apps/ai-help-desk/handoff-parser";
import { SUBMIT_BUTTON_CLASSES, getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";
import {
  buildContentWriterImportEntries,
  checkEntryExistsByFingerprint,
  type ImportEntry,
} from "@/lib/apps/ai-help-desk/content-writer-import";

interface ContentWriterImportModalProps {
  payload: ContentWriterHandoffPayload;
  isDark: boolean;
  businessId: string;
  isAlreadyImported: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function ContentWriterImportModal({
  payload,
  isDark,
  businessId,
  isAlreadyImported,
  onClose,
  onSuccess,
  onError,
}: ContentWriterImportModalProps) {
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<"article" | "faqs" | "both">(() => {
    const hasArticle = payload.mode === "content" && payload.article;
    const hasFaqs = payload.faqs && payload.faqs.length > 0;
    if (hasArticle && hasFaqs) return "both";
    if (hasArticle) return "article";
    return "faqs";
  });

  const hasArticle = payload.mode === "content" && payload.article;
  const hasFaqs = payload.faqs && payload.faqs.length > 0;

  const handleConfirm = async () => {
    if (isAlreadyImported) {
      return;
    }

    if (!businessId.trim()) {
      onError("Please select a business first");
      return;
    }

    setImporting(true);

    try {
      // Build entries array using helper
      const entries = buildContentWriterImportEntries(payload, importMode);
      
      if (entries.length === 0) {
        onError("No content to import");
        return;
      }

      let created = 0;
      let skipped = 0;

      // Import each entry
      for (const entry of entries) {
        // Check if entry already exists by fingerprint
        const exists = await checkEntryExistsByFingerprint(
          businessId.trim(),
          entry.fingerprint,
          entry.type
        );

        if (exists) {
          skipped++;
          continue;
        }

        // Build tags
        const tags: string[] = [
          "AI Content Writer",
          `importedAt:${payload.createdAt}`,
          `fingerprint:${entry.fingerprint}`,
        ];
        if (payload.businessContext?.topic) {
          tags.push(`topic:${payload.businessContext.topic}`);
        }
        if (payload.businessContext?.businessName) {
          tags.push(`business:${payload.businessContext.businessName}`);
        }
        if (payload.keywordsUsed && payload.keywordsUsed.length > 0) {
          tags.push(...payload.keywordsUsed.map((kw) => `keyword:${kw}`));
        }

        // Call API to create entry
        const res = await fetch("/api/ai-help-desk/knowledge/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: businessId.trim(),
            type: entry.type,
            title: entry.title,
            content: entry.body,
            tags,
            isActive: true,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || `Failed to create ${entry.type} entry`);
        }

        created++;
      }

      // Build success message
      let message = "Imported into Knowledge Manager";
      if (created > 0 || skipped > 0) {
        const parts: string[] = [];
        if (created > 0) {
          parts.push(`Created ${created}`);
        }
        if (skipped > 0) {
          parts.push(`Skipped ${skipped} (already exists)`);
        }
        message = parts.join(", ");
      }

      onSuccess(message);
      onClose();
    } catch (error) {
      console.error("Import error:", error);
      onError(
        error instanceof Error
          ? error.message
          : "Failed to import content. Please try again."
      );
    } finally {
      setImporting(false);
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
              <div>
                <h3
                  className={`text-lg font-semibold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Import Content
                </h3>
                <div className={`text-xs mt-1 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  Source: AI Content Writer
                  {payload.createdAt && (
                    <span className="ml-2">
                      • {new Date(payload.createdAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className={`text-2xl leading-none ${
                  isDark
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                aria-label="Close"
                disabled={importing}
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Already Imported Warning */}
            {isAlreadyImported && (
              <div
                className={`rounded-lg p-3 text-sm ${
                  isDark
                    ? "bg-amber-900/30 border border-amber-700 text-amber-200"
                    : "bg-amber-50 border border-amber-200 text-amber-800"
                }`}
              >
                <div className="font-medium mb-1">Already Imported</div>
                <div>This handoff was already imported in this session.</div>
              </div>
            )}

            {/* Import Options */}
            {!isAlreadyImported && (
              <div>
                <div
                  className={`text-sm font-semibold mb-3 ${
                    isDark ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  Import Options
                </div>
                <div className="space-y-2">
                  {hasArticle && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="article"
                        checked={importMode === "article"}
                        onChange={() => setImportMode("article")}
                        className="w-4 h-4"
                        disabled={importing}
                      />
                      <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        Import Article
                      </span>
                    </label>
                  )}
                  {hasFaqs && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="faqs"
                        checked={importMode === "faqs"}
                        onChange={() => setImportMode("faqs")}
                        className="w-4 h-4"
                        disabled={importing}
                      />
                      <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        Import FAQs
                      </span>
                    </label>
                  )}
                  {hasArticle && hasFaqs && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="both"
                        checked={importMode === "both"}
                        onChange={() => setImportMode("both")}
                        className="w-4 h-4"
                        disabled={importing}
                      />
                      <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        Import Both
                      </span>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Preview Summary */}
            <div>
              <h4
                className={`text-sm font-semibold mb-3 ${
                  isDark ? "text-slate-200" : "text-slate-700"
                }`}
              >
                Preview
              </h4>
              <div
                className={`rounded-lg border p-4 space-y-4 ${
                  isDark
                    ? "bg-slate-900/50 border-slate-700"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                {hasArticle && payload.article && (
                  <div>
                    <p className={`font-medium mb-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {payload.article.title}
                    </p>
                    <div className={`text-sm space-y-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      {payload.article.sections.slice(0, 2).map((section, index) => (
                        <div key={index}>• {section.heading}</div>
                      ))}
                      {payload.article.sections.length > 2 && (
                        <div className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          + {payload.article.sections.length - 2} more section{payload.article.sections.length - 2 !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {hasFaqs && payload.faqs && (
                  <div>
                    <p className={`font-medium mb-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      FAQs: {payload.faqs.length}
                    </p>
                    <div className={`text-sm space-y-2 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      {payload.faqs.slice(0, 2).map((faq, index) => (
                        <div key={index}>
                          <div className="font-medium">Q: {faq.question}</div>
                        </div>
                      ))}
                      {payload.faqs.length > 2 && (
                        <div className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          + {payload.faqs.length - 2} more FAQ{payload.faqs.length - 2 !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Business Context */}
            {payload.businessContext?.businessName ||
            payload.businessContext?.topic ? (
              <div
                className={`rounded-lg p-3 text-sm ${
                  isDark
                    ? "bg-slate-900/50 text-slate-300"
                    : "bg-slate-50 text-slate-600"
                }`}
              >
                <div className="font-medium mb-1">Context:</div>
                {payload.businessContext?.businessName && (
                  <div>Business: {payload.businessContext.businessName}</div>
                )}
                {payload.businessContext?.topic && (
                  <div>Topic: {payload.businessContext.topic}</div>
                )}
              </div>
            ) : null}
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
              disabled={importing}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={SUBMIT_BUTTON_CLASSES}
              disabled={importing || isAlreadyImported}
            >
              {importing ? "Importing..." : isAlreadyImported ? "Already Imported" : "Confirm Import"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

