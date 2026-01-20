"use client";

import { useMemo, useState } from "react";
import type { GbpToSchemaGeneratorHandoffV1 } from "@/lib/apps/google-business-pro/handoff";
import { SUBMIT_BUTTON_CLASSES, getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";

export type GbpSchemaImportSelection = {
  businessContext: boolean;
  services: boolean;
  faqs: boolean;
};

export default function GbpProImportModal({
  payload,
  isDark,
  onClose,
  onConfirm,
}: {
  payload: GbpToSchemaGeneratorHandoffV1;
  isDark: boolean;
  onClose: () => void;
  onConfirm: (selection: GbpSchemaImportSelection) => void;
}) {
  const hasServices = (payload.facts.services?.length ?? 0) > 0;
  const hasFaqs = (payload.facts.faqs?.length ?? 0) > 0;

  const defaultSelection = useMemo<GbpSchemaImportSelection>(() => {
    return {
      businessContext: true,
      services: hasServices,
      faqs: hasFaqs,
    };
  }, [hasServices, hasFaqs]);

  const [selection, setSelection] = useState<GbpSchemaImportSelection>(defaultSelection);

  const createdAtLabel = (() => {
    try {
      return new Date(payload.createdAt).toLocaleString();
    } catch {
      return payload.createdAt;
    }
  })();

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl pointer-events-auto ${
            isDark ? "bg-slate-800 border border-slate-700" : "bg-white border border-slate-200"
          }`}
        >
          <div className={`sticky top-0 px-6 py-4 border-b ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Review Import</h3>
                <div className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Source: Google Business Profile Pro • {createdAtLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`text-2xl leading-none ${isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"}`}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          <div className="px-6 py-4 space-y-6">
            <div>
              <div className={`text-sm font-semibold mb-3 ${isDark ? "text-slate-200" : "text-slate-700"}`}>Import Options</div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selection.businessContext}
                    onChange={(e) => setSelection((p) => ({ ...p, businessContext: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Business context (name/location/website/services input)
                  </span>
                </label>
                <label className={`flex items-center gap-2 ${hasServices ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
                  <input
                    type="checkbox"
                    checked={selection.services}
                    onChange={(e) => setSelection((p) => ({ ...p, services: e.target.checked }))}
                    className="w-4 h-4"
                    disabled={!hasServices}
                  />
                  <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Services ({payload.facts.services?.length ?? 0})
                  </span>
                </label>
                <label className={`flex items-center gap-2 ${hasFaqs ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
                  <input
                    type="checkbox"
                    checked={selection.faqs}
                    onChange={(e) => setSelection((p) => ({ ...p, faqs: e.target.checked }))}
                    className="w-4 h-4"
                    disabled={!hasFaqs}
                  />
                  <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    FAQs ({payload.facts.faqs?.length ?? 0})
                  </span>
                </label>
              </div>
              <p className={`text-xs mt-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Additive only: existing services/FAQs are preserved; duplicates are skipped.
              </p>
            </div>

            <div>
              <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-slate-200" : "text-slate-700"}`}>Preview</h4>
              <div className={`rounded-lg border p-4 space-y-3 ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                <div className={`text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  <span className="font-medium">Business:</span>{" "}
                  {[payload.context.businessName, payload.context.city, payload.context.state].filter(Boolean).join(" • ") || "—"}
                </div>
                {hasServices && (
                  <div className={`text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    <span className="font-medium">Services:</span>{" "}
                    {(payload.facts.services ?? []).slice(0, 6).join(", ")}
                    {(payload.facts.services ?? []).length > 6 ? "…" : ""}
                  </div>
                )}
                {hasFaqs && (
                  <div className={`text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    <span className="font-medium">FAQs:</span>{" "}
                    {(payload.facts.faqs ?? []).slice(0, 2).map((f) => f.question).join(" • ")}
                    {(payload.facts.faqs ?? []).length > 2 ? "…" : ""}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className={getSecondaryButtonClasses(isDark)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirm(selection)}
                className={SUBMIT_BUTTON_CLASSES}
                disabled={!selection.businessContext && !selection.services && !selection.faqs}
                title={!selection.businessContext && !selection.services && !selection.faqs ? "Select at least one option." : undefined}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

