"use client";

import { useState } from "react";
import { getLocalAnalytics, formatLastUsed, formatExportTypeLabel } from "@/lib/bdw/local-analytics";

interface AnalyticsDetailsProps {
  storageKey: string;
  isDark: boolean;
}

export default function AnalyticsDetails({ storageKey, isDark }: AnalyticsDetailsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const analytics = getLocalAnalytics(storageKey);

  const hasData = analytics.lastGeneratedAt || analytics.lastFixPackAppliedId || analytics.lastExportTypeUsed;

  if (!hasData) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
          isDark
            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
        aria-label="Show usage details"
      >
        Details
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className={`absolute right-0 mt-2 w-56 rounded-lg border shadow-lg z-20 ${
            isDark
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200"
          }`}>
            <div className="p-3 space-y-2">
              <h4 className={`text-xs font-semibold mb-2 ${
                isDark ? "text-slate-200" : "text-slate-900"
              }`}>
                Last Used
              </h4>
              
              {analytics.lastGeneratedAt && (
                <div>
                  <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    Generated:
                  </span>
                  <span className={`text-xs ml-2 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    {formatLastUsed(analytics.lastGeneratedAt)}
                  </span>
                </div>
              )}
              
              {analytics.lastFixPackAppliedId && (
                <div>
                  <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    Fix Pack:
                  </span>
                  <span className={`text-xs ml-2 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    {analytics.lastFixPackAppliedId}
                  </span>
                </div>
              )}
              
              {analytics.lastExportTypeUsed && (
                <div>
                  <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    Export:
                  </span>
                  <span className={`text-xs ml-2 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    {formatExportTypeLabel(analytics.lastExportTypeUsed)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

