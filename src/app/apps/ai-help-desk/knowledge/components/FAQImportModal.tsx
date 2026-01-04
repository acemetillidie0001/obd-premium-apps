"use client";

import { useState } from "react";
import type { HelpDeskHandoffPayload } from "@/lib/apps/ai-help-desk/handoff-parser";
import { SUBMIT_BUTTON_CLASSES, getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";

interface FAQImportModalProps {
  payload: HelpDeskHandoffPayload;
  isDark: boolean;
  businessId: string;
  isAlreadyImported: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function FAQImportModal({
  payload,
  isDark,
  businessId,
  isAlreadyImported,
  onClose,
  onSuccess,
  onError,
}: FAQImportModalProps) {
  const [importing, setImporting] = useState(false);

  const handleConfirm = async () => {
    if (isAlreadyImported) {
      // Prevent import if already imported
      return;
    }

    if (!businessId.trim()) {
      onError("Please select a business first");
      return;
    }

    setImporting(true);

    try {
      if (payload.mode === "qa") {
        // Import as individual Q&A entries
        const promises = payload.items.map(async (item) => {
          // Build tags with metadata
          const tags: string[] = [
            "AI FAQ Generator",
            `importedAt:${payload.importedAt}`,
          ];
          if (payload.businessContext.topic) {
            tags.push(`topic:${payload.businessContext.topic}`);
          }
          if (payload.businessContext.businessName) {
            tags.push(`business:${payload.businessContext.businessName}`);
          }

          const res = await fetch("/api/ai-help-desk/knowledge/upsert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId: businessId.trim(),
              type: "FAQ",
              title: item.question,
              content: item.answer,
              tags,
              isActive: true,
            }),
          });

          const json = await res.json();
          if (!res.ok || !json.ok) {
            throw new Error(json.error || "Failed to create knowledge entry");
          }
        });

        await Promise.all(promises);
      } else {
        // Import as a single FAQ document
        // Combine all Q&As into one document
        const content = payload.items
          .map((item, index) => {
            return `Q${index + 1}: ${item.question}\n\nA${index + 1}: ${item.answer}`;
          })
          .join("\n\n---\n\n");

        // Build tags with metadata
        const tags: string[] = [
          "AI FAQ Generator",
          "FAQ Document",
          `importedAt:${payload.importedAt}`,
        ];
        if (payload.businessContext.topic) {
          tags.push(`topic:${payload.businessContext.topic}`);
        }
        if (payload.businessContext.businessName) {
          tags.push(`business:${payload.businessContext.businessName}`);
        }

        const res = await fetch("/api/ai-help-desk/knowledge/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: businessId.trim(),
            type: "FAQ",
            title: payload.title,
            content,
            tags,
            isActive: true,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to create knowledge entry");
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Import error:", error);
      onError(
        error instanceof Error
          ? error.message
          : "Failed to import FAQs. Please try again."
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
              <h3
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Import FAQs from AI FAQ Generator
              </h3>
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

            {/* Import Mode Info */}
            <div>
              <div
                className={`text-sm font-semibold mb-2 ${
                  isDark ? "text-slate-200" : "text-slate-700"
                }`}
              >
                Import Mode:{" "}
                {payload.mode === "qa"
                  ? "Individual Q&A Entries"
                  : "Single FAQ Document"}
              </div>
              <div
                className={`text-xs ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {payload.mode === "qa"
                  ? `This will create ${payload.items.length} separate knowledge entries, one for each question and answer.`
                  : `This will create one knowledge document containing all ${payload.items.length} FAQs.`}
              </div>
            </div>

            {/* Preview */}
            <div>
              <h4
                className={`text-sm font-semibold mb-3 ${
                  isDark ? "text-slate-200" : "text-slate-700"
                }`}
              >
                Preview ({payload.items.length} FAQ
                {payload.items.length !== 1 ? "s" : ""})
              </h4>
              <div
                className={`max-h-64 overflow-y-auto rounded-lg border p-4 space-y-3 ${
                  isDark
                    ? "bg-slate-900/50 border-slate-700"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                {payload.items.map((item, index) => (
                  <div
                    key={index}
                    className={`pb-3 ${
                      index < payload.items.length - 1
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
                      Q: {item.question}
                    </p>
                    <p
                      className={`text-sm ${
                        isDark ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      A: {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Business Context */}
            {payload.businessContext.businessName ||
            payload.businessContext.topic ? (
              <div
                className={`rounded-lg p-3 text-sm ${
                  isDark
                    ? "bg-slate-900/50 text-slate-300"
                    : "bg-slate-50 text-slate-600"
                }`}
              >
                <div className="font-medium mb-1">Context:</div>
                {payload.businessContext.businessName && (
                  <div>Business: {payload.businessContext.businessName}</div>
                )}
                {payload.businessContext.topic && (
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

