"use client";

import { useEffect } from "react";
import type { BusinessDescriptionResponseExport as BusinessDescriptionResponse } from "@/lib/bdw";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export interface QualityPreviewModalProps {
  previewState: {
    isOpen: boolean;
    fixId: string;
    fixTitle: string;
    targetKeys: string[];
    proposed: Partial<BusinessDescriptionResponse>;
  };
  baseResult: BusinessDescriptionResponse;
  onClose: () => void;
  onApply: () => void;
  isDark: boolean;
  triggerElement?: HTMLElement | null;
}

export default function QualityPreviewModal({
  previewState,
  baseResult,
  onClose,
  onApply,
  isDark,
  triggerElement,
}: QualityPreviewModalProps) {
  // Focus trap hook
  const modalRef = useFocusTrap({
    isOpen: previewState.isOpen,
    onClose,
    triggerElement,
  });

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const fieldNames: Record<string, string> = {
    obdListingDescription: "OBD Listing",
    googleBusinessDescription: "Google Business Profile",
    websiteAboutUs: "Website/About",
    elevatorPitch: "Citations",
    metaDescription: "Meta Description",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={modalRef}
        className={`relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border shadow-xl ${
          isDark
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quality-preview-title"
      >
        <div className={`sticky top-0 flex items-center justify-between p-4 border-b ${
          isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
        }`}>
          <div>
            <h3 id="quality-preview-title" className={`text-lg font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}>
              {previewState.fixTitle} Preview
            </h3>
            <p className={`text-xs mt-1 ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              Review changes before applying
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? "hover:bg-slate-700 text-slate-300"
                : "hover:bg-slate-100 text-slate-600"
            }`}
            aria-label="Close preview"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-4">
          {previewState.targetKeys.map((key) => {
            const originalValue = (baseResult as any)[key] || "";
            const proposedValue = (previewState.proposed as any)[key] || "";
            const fieldName = fieldNames[key] || key;
            
            return (
              <div key={key} className={`rounded-lg border ${
                isDark
                  ? "bg-slate-900/50 border-slate-600"
                  : "bg-white border-slate-300"
              }`}>
                <div className={`px-4 py-3 border-b ${
                  isDark ? "border-slate-700" : "border-slate-200"
                }`}>
                  <h4 className={`font-semibold text-sm ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}>
                    {fieldName}
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                  <div>
                    <div className={`text-xs mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Before ({originalValue.length} chars)
                    </div>
                    <div className={`rounded border p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto ${
                      isDark
                        ? "bg-slate-900 border-slate-600 text-slate-100"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}>
                      {originalValue || <span className={isDark ? "text-slate-500" : "text-slate-400"}>No content</span>}
                    </div>
                  </div>
                  <div>
                    <div className={`text-xs mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      After ({proposedValue.length} chars)
                    </div>
                    <div className={`rounded border p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto ${
                      isDark
                        ? "bg-slate-900 border-green-600/50 text-green-100"
                        : "bg-green-50 border-green-200 text-green-800"
                    }`}>
                      {proposedValue || <span className={isDark ? "text-slate-500" : "text-slate-400"}>No content</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className={`sticky bottom-0 flex items-center justify-end gap-3 p-4 border-t ${
          isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#29c4a9] text-white hover:bg-[#25b09a]"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}

