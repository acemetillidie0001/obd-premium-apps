"use client";

import { SUBMIT_BUTTON_CLASSES, getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";
import type { GbpToContentWriterHandoffV1 } from "@/lib/apps/google-business-pro/handoff";

export default function GbpProImportBanner({
  isDark,
  payload,
  onApplyToInputs,
  onDismiss,
}: {
  isDark: boolean;
  payload: GbpToContentWriterHandoffV1;
  onApplyToInputs: () => void;
  onDismiss: () => void;
}) {
  const summaryParts: string[] = [];
  if (payload.context.businessName) summaryParts.push(payload.context.businessName);
  if (payload.context.businessType) summaryParts.push(payload.context.businessType);
  const loc = [payload.context.city, payload.context.state].filter(Boolean).join(", ");
  if (loc) summaryParts.push(loc);
  summaryParts.push(payload.block.title);

  const summary = summaryParts.filter(Boolean).join(" • ");

  return (
    <div
      className={`mb-6 rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        isDark ? "bg-blue-900/20 border-blue-700" : "bg-blue-50 border-blue-200"
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-1">
        <p className={`text-sm font-medium ${isDark ? "text-blue-300" : "text-blue-800"}`}>
          <strong>Imported from Google Business Profile Pro</strong>
        </p>
        <p className={`text-xs mt-1 ${isDark ? "text-blue-400" : "text-blue-700"}`}>{summary}</p>
        <p className={`text-xs mt-1 ${isDark ? "text-blue-400/80" : "text-blue-700/80"}`}>
          Apply-only — nothing is generated automatically.
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button type="button" onClick={onApplyToInputs} className={SUBMIT_BUTTON_CLASSES}>
          Apply to inputs
        </button>
        <button type="button" onClick={onDismiss} className={getSecondaryButtonClasses(isDark)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

