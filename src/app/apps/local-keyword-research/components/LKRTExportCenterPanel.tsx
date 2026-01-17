"use client";

import { useMemo, useState } from "react";
import {
  downloadBlob,
  generateFullReportTxt,
  generateKeywordsCsv,
  getCsvFilename,
  getTxtFilename,
} from "@/lib/exports/local-keyword-exports";
import type {
  LocalKeywordIdea,
  LocalKeywordRequest,
  LocalKeywordResponse,
} from "@/app/api/local-keyword-research/types";

export default function LKRTExportCenterPanel({
  isDark,
  isLoading,
  activeResult,
  visibleKeywords,
  allKeywords,
  form,
}: {
  isDark: boolean;
  isLoading: boolean;
  activeResult: LocalKeywordResponse | null;
  visibleKeywords: LocalKeywordIdea[];
  allKeywords: LocalKeywordIdea[];
  form: LocalKeywordRequest;
}) {
  const [copiedTopKeywords, setCopiedTopKeywords] = useState(false);

  const hasVolume = useMemo(
    () => allKeywords.some((k) => typeof k.monthlySearchesExact === "number"),
    [allKeywords]
  );
  const hasCpc = useMemo(
    () => allKeywords.some((k) => typeof k.cpcUsd === "number"),
    [allKeywords]
  );

  const canUseActive = !!activeResult && !isLoading;
  const canExportTxt = canUseActive;
  const canExportCsv = canUseActive && visibleKeywords.length > 0;
  const canCopyVisibleKeywords = canUseActive && visibleKeywords.length > 0;

  const buttonClasses = (active?: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      active
        ? "bg-[#29c4a9] text-white"
        : isDark
        ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
        : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
    }`;

  const buildVisibleKeywordsCopyText = () => {
    return visibleKeywords
      .map(
        (k) =>
          `${k.keyword} — ${k.intent} — ${k.suggestedPageType} — ${k.difficultyLabel} — Score: ${k.opportunityScore}` +
          `${
            hasVolume && typeof k.monthlySearchesExact === "number"
              ? ` — Volume: ${k.monthlySearchesExact}`
              : ""
          }` +
          `${
            hasCpc && typeof k.cpcUsd === "number"
              ? ` — CPC: $${k.cpcUsd.toFixed(2)}`
              : ""
          }`
      )
      .join("\n");
  };

  const handleCopyVisibleKeywords = async () => {
    if (!canCopyVisibleKeywords) return;
    try {
      await navigator.clipboard.writeText(buildVisibleKeywordsCopyText());
      setCopiedTopKeywords(true);
      setTimeout(() => setCopiedTopKeywords(false), 1500);
    } catch {
      // ignore copy errors
    }
  };

  const handleExportCsv = () => {
    if (!canExportCsv) return;
    const meta = {
      businessName: form.businessName || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      goal: form.primaryGoal || undefined,
      generatedAt: new Date(),
      nearMe: form.includeNearMeVariants,
    };
    const csv = generateKeywordsCsv(visibleKeywords, meta);
    const filename = getCsvFilename(form.businessName);
    downloadBlob(csv, filename, "text/csv");
  };

  const handleExportTxt = () => {
    if (!canExportTxt || !activeResult) return;
    const meta = {
      businessName: form.businessName || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      goal: form.primaryGoal || undefined,
      generatedAt: new Date(),
    };
    const settings = {
      maxKeywords: form.maxKeywords,
      nearMe: form.includeNearMeVariants,
      radiusMiles: form.radiusMiles,
      neighborhoods: form.includeNeighborhoods,
      zipCodes: form.includeZipCodes,
      language: form.language,
    };
    const txt = generateFullReportTxt(activeResult, meta, settings);
    const filename = getTxtFilename(form.businessName);
    downloadBlob(txt, filename, "text/plain");
  };

  const disabledReason = !activeResult
    ? "Generate results first to enable export."
    : isLoading
    ? "Please wait…"
    : undefined;

  const csvDisabledReason =
    disabledReason ||
    (visibleKeywords.length === 0 ? "No keywords match your current filters." : undefined);

  return (
    <div className="space-y-6">
      <div>
        <h4 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
          Export Formats
        </h4>
        <p className={`text-xs mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Export uses the current active results (edited &gt; generated). CSV + Copy reflect your current filters/sort.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportTxt}
            disabled={!canExportTxt}
            className={buttonClasses(false)}
            title={disabledReason}
          >
            Export TXT (Full Report)
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!canExportCsv}
            className={buttonClasses(false)}
            title={csvDisabledReason}
          >
            Export CSV (Top Keywords)
          </button>
          <button
            type="button"
            onClick={handleCopyVisibleKeywords}
            disabled={!canCopyVisibleKeywords}
            className={buttonClasses(copiedTopKeywords)}
            title={csvDisabledReason}
          >
            {copiedTopKeywords ? "Copied!" : "Copy Top Keywords (Visible)"}
          </button>
        </div>
      </div>
    </div>
  );
}


