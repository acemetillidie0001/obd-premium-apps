"use client";

import type { SeoAuditRoadmapApplyToInputsPayload } from "@/lib/apps/seo-audit-roadmap/apply-to-inputs-handoff";

export default function SeoAuditApplyToInputsModal({
  isDark,
  payload,
  fields,
  onApply,
  onDismiss,
  blockedReason,
}: {
  isDark: boolean;
  payload: SeoAuditRoadmapApplyToInputsPayload;
  fields: Array<{ label: string; preview: string }>;
  onApply: () => void;
  onDismiss: () => void;
  blockedReason: string | null;
}) {
  const panel = isDark ? "bg-slate-950 border-slate-700" : "bg-white border-slate-200";
  const title = isDark ? "text-slate-100" : "text-slate-900";
  const muted = isDark ? "text-slate-300" : "text-slate-600";
  const subtle = isDark ? "text-slate-400" : "text-slate-500";

  const primaryBtn = isDark
    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
    : "bg-indigo-600 hover:bg-indigo-700 text-white";

  const secondaryBtn = isDark
    ? "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700"
    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onDismiss} />

      <div className={`relative w-full max-w-lg rounded-xl border p-5 shadow-xl ${panel}`}>
        <div className={`text-sm font-semibold ${title}`}>Apply SEO audit input suggestions?</div>
        <div className={`mt-1 text-xs ${muted}`}>
          We can pre-fill inputs based on your SEO audit. This will pre-fill draft inputs only. Nothing is generated or
          published automatically.
        </div>

        <div className={`mt-3 text-xs ${subtle}`}>
          Finding: <span className="font-medium">{payload.category}</span> · Type:{" "}
          <span className="font-medium">{payload.recommendationType}</span>
        </div>

        {blockedReason ? (
          <div
            className={`mt-4 rounded-lg border p-3 text-sm ${
              isDark ? "border-red-800/60 bg-red-900/20 text-red-200" : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {blockedReason}
          </div>
        ) : (
          <div className="mt-4">
            <div className={`text-xs font-semibold ${title}`}>Inputs we’ll pre-fill</div>
            <ul className={`mt-2 space-y-2 text-xs ${muted}`}>
              {fields.length === 0 ? (
                <li>No applicable inputs were suggested for this app.</li>
              ) : (
                fields.map((f) => (
                  <li key={f.label} className="flex gap-2">
                    <span className={`min-w-28 font-medium ${title}`}>{f.label}:</span>
                    <span className="min-w-0 break-words">{f.preview}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-xs font-medium ${secondaryBtn}`}
            onClick={onDismiss}
          >
            Dismiss
          </button>
          <button
            type="button"
            disabled={!!blockedReason}
            className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${primaryBtn}`}
            onClick={onApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}


