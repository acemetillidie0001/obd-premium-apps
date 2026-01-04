"use client";

import { useState } from "react";
import type { ContentWriterSchemaHandoff } from "@/lib/apps/business-schema-generator/handoff-parser";
import { SUBMIT_BUTTON_CLASSES, getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";

interface ContentWriterSchemaImportModalProps {
  payload: ContentWriterSchemaHandoff;
  isDark: boolean;
  isAlreadyImported: boolean;
  onClose: () => void;
  onConfirm: (importMode: "faqs" | "page-meta") => void;
}

export default function ContentWriterSchemaImportModal({
  payload,
  isDark,
  isAlreadyImported,
  onClose,
  onConfirm,
}: ContentWriterSchemaImportModalProps) {
  const hasFaqs = payload.mode === "faq" && payload.faqs && payload.faqs.length > 0;
  const hasPageMeta = payload.mode === "page-meta" && payload.pageMeta && (
    payload.pageMeta.pageTitle || payload.pageMeta.pageDescription || payload.pageMeta.pageUrl
  );

  const [importMode, setImportMode] = useState<"faqs" | "page-meta">(() => {
    if (hasFaqs) return "faqs";
    return "page-meta";
  });

  const handleConfirm = () => {
    if (isAlreadyImported) {
      return;
    }
    onConfirm(importMode);
  };

  // Format createdAt date
  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
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
                  Review Import
                </h3>
                <div className={`text-xs mt-1 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  Source: AI Content Writer
                  {payload.createdAt && (
                    <span className="ml-2">
                      • {formatDate(payload.createdAt)}
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
                  {hasFaqs && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="faqs"
                        checked={importMode === "faqs"}
                        onChange={() => setImportMode("faqs")}
                        className="w-4 h-4"
                      />
                      <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        Import FAQs as FAQPage schema
                      </span>
                    </label>
                  )}
                  {hasPageMeta && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="page-meta"
                        checked={importMode === "page-meta"}
                        onChange={() => setImportMode("page-meta")}
                        className="w-4 h-4"
                      />
                      <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        Import Page Meta fields
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
                {hasFaqs && payload.mode === "faq" && payload.faqs && (
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

                {hasPageMeta && payload.mode === "page-meta" && payload.pageMeta && (
                  <div>
                    <p className={`font-medium mb-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      Page Meta
                    </p>
                    <div className={`text-sm space-y-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      {payload.pageMeta.pageTitle && (
                        <div><span className="font-medium">Title:</span> {payload.pageMeta.pageTitle}</div>
                      )}
                      {payload.pageMeta.pageDescription && (
                        <div>
                          <span className="font-medium">Description:</span>{" "}
                          {payload.pageMeta.pageDescription.length > 100
                            ? `${payload.pageMeta.pageDescription.substring(0, 100)}...`
                            : payload.pageMeta.pageDescription}
                        </div>
                      )}
                      {payload.pageMeta.pageUrl && (
                        <div><span className="font-medium">Slug:</span> {payload.pageMeta.pageUrl}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Business Context */}
            {payload.businessContext && (
              (payload.businessContext.businessName || payload.businessContext.topic) && (
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
              )
            )}
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
              disabled={isAlreadyImported}
            >
              {isAlreadyImported ? "Already Imported" : "Confirm Import"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

