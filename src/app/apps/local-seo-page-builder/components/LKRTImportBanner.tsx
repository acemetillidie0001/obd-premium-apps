"use client";

import type { LkrtToLocalSeoSuggestionsHandoffV1 } from "@/lib/apps/local-keyword-research/handoff";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";

export default function LKRTImportBanner({
  isDark,
  payload,
  canApply,
  applyBlockedReason,
  onDismiss,
  onApply,
}: {
  isDark: boolean;
  payload: LkrtToLocalSeoSuggestionsHandoffV1;
  canApply: boolean;
  applyBlockedReason?: string;
  onDismiss: () => void;
  onApply: () => void;
}) {
  const muted = isDark ? "text-slate-300" : "text-slate-600";
  const buttonSecondary = isDark
    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200";

  const buttonPrimary = isDark
    ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
    : "bg-[#29c4a9] text-white hover:bg-[#24b09a]";

  const primaryKeywords = payload.suggestions.primaryKeywords || [];
  const secondaryKeywords = payload.suggestions.secondaryKeywords || [];
  const topics = payload.suggestions.topics || [];

  return (
    <OBDPanel isDark={isDark}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <OBDHeading level={2} isDark={isDark}>
            Import LKRT draft suggestions
          </OBDHeading>
          <div className={`mt-1 text-xs ${muted}`}>
            Nothing is applied automatically. Review the preview, then click Apply to merge additively.
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onApply}
            disabled={!canApply}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${buttonPrimary} ${
              !canApply ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title={!canApply ? applyBlockedReason : "Apply suggestions (additive only)"}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${buttonSecondary}`}
          >
            Dismiss
          </button>
        </div>
      </div>

      {!canApply && applyBlockedReason ? (
        <div className="mt-4">
          <p className={`text-sm font-semibold ${isDark ? "text-amber-300" : "text-amber-800"}`}>
            {applyBlockedReason}
          </p>
          <p className={`text-xs mt-1 ${muted}`}>
            Apply is disabled for tenant safety. You can still Dismiss.
          </p>
        </div>
      ) : null}

      <div className={`mt-4 text-xs ${muted}`}>
        <span className="font-medium">Seed:</span>{" "}
        {(payload.context.seedKeywords || []).slice(0, 6).join(", ") || "—"}{" "}
        <span className="mx-2">•</span>
        <span className="font-medium">Location:</span>{" "}
        {payload.context.location?.city}, {payload.context.location?.state}{" "}
        {payload.context.nearMe ? <span className="mx-2">•</span> : null}
        {payload.context.nearMe ? <span className="font-medium">near me</span> : null}
        <span className="mx-2">•</span>
        <span className="font-medium">Metrics:</span> {payload.context.metricsMode || "—"}
      </div>

      {(primaryKeywords.length > 0 ||
        secondaryKeywords.length > 0 ||
        topics.length > 0) && (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <div
              className={`text-xs font-semibold ${
                isDark ? "text-slate-100" : "text-slate-800"
              }`}
            >
              Keywords (top)
            </div>
            <ul className={`mt-1 list-disc pl-4 text-xs ${muted}`}>
              {primaryKeywords.slice(0, 8).map((k) => (
                <li key={k}>{k}</li>
              ))}
              {primaryKeywords.length === 0 && <li>—</li>}
            </ul>
          </div>
          <div>
            <div
              className={`text-xs font-semibold ${
                isDark ? "text-slate-100" : "text-slate-800"
              }`}
            >
              Keywords (secondary)
            </div>
            <ul className={`mt-1 list-disc pl-4 text-xs ${muted}`}>
              {secondaryKeywords.slice(0, 8).map((k) => (
                <li key={k}>{k}</li>
              ))}
              {secondaryKeywords.length === 0 && <li>—</li>}
            </ul>
          </div>
          <div>
            <div
              className={`text-xs font-semibold ${
                isDark ? "text-slate-100" : "text-slate-800"
              }`}
            >
              Topic seeds
            </div>
            <ul className={`mt-1 list-disc pl-4 text-xs ${muted}`}>
              {topics.slice(0, 8).map((t) => (
                <li key={t}>{t}</li>
              ))}
              {topics.length === 0 && <li>—</li>}
            </ul>
          </div>
        </div>
      )}
    </OBDPanel>
  );
}


