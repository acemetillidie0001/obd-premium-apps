"use client";

import type { WebDraftPayload, WebDraftSection } from "@/lib/handoff/types";
import { SUBMIT_BUTTON_CLASSES, getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";

interface WebDraftReviewModalProps {
  payload: WebDraftPayload;
  isDark: boolean;
  isAlreadyImported: boolean;
  onClose: () => void;
  onAccept: () => void;
}

function renderSectionPreview(section: WebDraftSection, isDark: boolean): React.ReactNode {
  if (section.type === "heading") {
    const level = section.level || 2;
    // Stronger text for headings: font-semibold -> font-bold
    const className = `font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`;
    if (level === 2) {
      return <h2 className={className}>{section.text}</h2>;
    } else if (level === 3) {
      return <h3 className={className}>{section.text}</h3>;
    } else if (level === 4) {
      return <h4 className={className}>{section.text}</h4>;
    }
    return <h2 className={className}>{section.text}</h2>;
  } else if (section.type === "paragraph") {
    return (
      <p className={`text-sm mb-3 whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-slate-700"}`}>
        {section.text}
      </p>
    );
  } else if (section.type === "list") {
    // Show bullet list with first 6 items max
    const maxItems = 6;
    const itemsToShow = section.items?.slice(0, maxItems) || [];
    return (
      <ul className={`list-disc list-inside mb-3 space-y-1 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
        {itemsToShow.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
        {section.items && section.items.length > maxItems && (
          <li className={isDark ? "text-slate-500" : "text-slate-500"}>
            ...and {section.items.length - maxItems} more
          </li>
        )}
      </ul>
    );
  }
  return null;
}

export default function WebDraftReviewModal({
  payload,
  isDark,
  isAlreadyImported,
  onClose,
  onAccept,
}: WebDraftReviewModalProps) {
  const previewSections = payload.content.sections.slice(0, 6);
  const hasMoreSections = payload.content.sections.length > 6;

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
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
          isDark ? "" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
      >
        <div
          className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border shadow-xl ${
            isDark
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between p-6 border-b ${
              isDark ? "border-slate-700" : "border-slate-200"
            }`}
          >
            <h2
              id="review-modal-title"
              className={`text-xl font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Review Draft
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDark
                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
              aria-label="Close modal"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <h3 className={`text-lg font-semibold mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                {payload.content.title}
              </h3>
              {payload.content.slug && (
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Slug: {payload.content.slug}
                </p>
              )}
            </div>

            {/* Excerpt */}
            {payload.content.excerpt && (
              <div>
                <p className={`text-sm italic ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {payload.content.excerpt}
                </p>
              </div>
            )}

            {/* Sections Preview */}
            <div>
              <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
                Content Preview
              </h4>
              <div className="space-y-4">
                {previewSections.map((section, idx) => (
                  <div key={idx}>
                    {renderSectionPreview(section, isDark)}
                  </div>
                ))}
                {hasMoreSections && (
                  <p className={`text-sm italic ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    ...and {payload.content.sections.length - 6} more section{payload.content.sections.length - 6 !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Call to Action */}
            {payload.content.callToAction && (
              <div>
                <h4 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  Call to Action
                </h4>
                <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {payload.content.callToAction}
                </p>
              </div>
            )}

            {/* Meta */}
            {payload.meta && (
              <div>
                <h4 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  Meta Information
                </h4>
                <div className={`rounded-lg border p-3 space-y-2 ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  {payload.meta.seoTitle && (
                    <div>
                      <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        SEO Title:
                      </span>
                      <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {payload.meta.seoTitle}
                      </p>
                    </div>
                  )}
                  {payload.meta.seoDescription && (
                    <div>
                      <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        SEO Description:
                      </span>
                      <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {payload.meta.seoDescription}
                      </p>
                    </div>
                  )}
                  {payload.meta.canonicalUrl && (
                    <div>
                      <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        Canonical URL:
                      </span>
                      <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {payload.meta.canonicalUrl}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Already Imported Warning */}
            {isAlreadyImported && (
              <div
                className={`rounded-lg border p-3 ${
                  isDark
                    ? "bg-yellow-900/20 border-yellow-700"
                    : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <p className={`text-sm ${
                  isDark ? "text-yellow-300" : "text-yellow-800"
                }`}>
                  This draft was already imported in this session.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className={`flex items-center justify-end gap-3 p-6 border-t ${
              isDark ? "border-slate-700" : "border-slate-200"
            }`}
          >
            <button
              onClick={onClose}
              className={getSecondaryButtonClasses(isDark)}
            >
              Cancel
            </button>
            <button
              onClick={onAccept}
              disabled={isAlreadyImported}
              className={SUBMIT_BUTTON_CLASSES}
            >
              Accept Draft
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

