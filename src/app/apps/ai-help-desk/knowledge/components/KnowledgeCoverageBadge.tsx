"use client";

import { computeCoverage, type CoverageStatus } from "../utils/coverage-helper";
import type { KnowledgeEntry } from "./KnowledgeList";

interface KnowledgeCoverageBadgeProps {
  isDark: boolean;
  entries: KnowledgeEntry[] | null | undefined;
}

export default function KnowledgeCoverageBadge({
  isDark,
  entries,
}: KnowledgeCoverageBadgeProps) {
  const coverage = computeCoverage(entries);

  const getStatusConfig = (status: CoverageStatus) => {
    switch (status) {
      case "Strong":
        return {
          bgColor: isDark ? "bg-green-900/30" : "bg-green-50",
          borderColor: isDark ? "border-green-700" : "border-green-200",
          textColor: isDark ? "text-green-400" : "text-green-700",
        };
      case "Partial":
        return {
          bgColor: isDark ? "bg-yellow-900/30" : "bg-yellow-50",
          borderColor: isDark ? "border-yellow-700" : "border-yellow-200",
          textColor: isDark ? "text-yellow-400" : "text-yellow-700",
        };
      case "Needs improvement":
        return {
          bgColor: isDark ? "bg-orange-900/30" : "bg-orange-50",
          borderColor: isDark ? "border-orange-700" : "border-orange-200",
          textColor: isDark ? "text-orange-400" : "text-orange-700",
        };
      case "Unknown":
        return {
          bgColor: isDark ? "bg-slate-800/50" : "bg-slate-50",
          borderColor: isDark ? "border-slate-700" : "border-slate-200",
          textColor: isDark ? "text-slate-400" : "text-slate-600",
        };
    }
  };

  const config = getStatusConfig(coverage.status);
  const tooltipText =
    coverage.status === "Unknown"
      ? "Add knowledge entries to improve coverage."
      : coverage.status === "Strong"
        ? `Your knowledge base has ${coverage.entryCount} entries across ${coverage.typeCount} type${coverage.typeCount === 1 ? "" : "s"}.`
        : coverage.status === "Partial"
          ? `Your knowledge base has ${coverage.entryCount} entries. Consider adding more entries or diversifying types for better coverage.`
          : `Your knowledge base has ${coverage.entryCount} entries. Add more entries to improve coverage.`;

  // Map status to progress percentage
  const getProgressPercentage = (status: CoverageStatus): number | null => {
    switch (status) {
      case "Needs improvement":
        return 20;
      case "Partial":
        return 60;
      case "Strong":
        return 100;
      case "Unknown":
        return null;
    }
  };

  const progressPercentage = getProgressPercentage(coverage.status);

  return (
    <div className="relative group">
      <div className="inline-flex flex-col">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-default ${config.bgColor} ${config.borderColor} ${config.textColor}`}
          role="status"
          aria-label={`Knowledge coverage: ${coverage.status}`}
        >
          Knowledge coverage: {coverage.status}
        </span>
        {progressPercentage !== null && (
          <div
            className={`h-0.5 mt-1 rounded-full overflow-hidden ${
              isDark ? "bg-slate-700" : "bg-slate-200"
            }`}
            style={{ width: "100%" }}
            role="progressbar"
            aria-valuenow={progressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Coverage progress: ${progressPercentage}%`}
          >
            <div
              className={`h-full transition-all ${
                coverage.status === "Strong"
                  ? isDark
                    ? "bg-green-400"
                    : "bg-green-600"
                  : coverage.status === "Partial"
                    ? isDark
                      ? "bg-yellow-400"
                      : "bg-yellow-600"
                    : isDark
                      ? "bg-orange-400"
                      : "bg-orange-600"
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>
      <div
        className={`absolute left-0 top-full mt-2 z-50 px-3 py-2 text-xs rounded-lg border shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal max-w-xs ${config.bgColor} ${config.borderColor} ${config.textColor}`}
        role="tooltip"
        aria-hidden="true"
      >
        {tooltipText}
      </div>
    </div>
  );
}

