"use client";

import OBDPanel from "@/components/obd/OBDPanel";

interface SetupProgressProps {
  requiredComplete: number;
  requiredTotal: number;
  isDark: boolean;
}

/**
 * SetupProgress Component
 * 
 * Displays progress indicator for required sections.
 */
export default function SetupProgress({
  requiredComplete,
  requiredTotal,
  isDark,
}: SetupProgressProps) {
  const percentage = requiredTotal > 0 ? Math.round((requiredComplete / requiredTotal) * 100) : 0;
  const themeClasses = {
    text: isDark ? "text-slate-300" : "text-slate-700",
    muted: isDark ? "text-slate-400" : "text-slate-600",
  };

  return (
    <OBDPanel isDark={isDark} className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className={`text-sm font-medium ${themeClasses.text}`}>
            Setup Progress
          </h3>
          <p className={`text-sm mt-1 ${themeClasses.muted}`}>
            {requiredComplete} of {requiredTotal} required sections complete
          </p>
        </div>
        <div className={`text-lg font-semibold ${themeClasses.text}`}>
          {percentage}%
        </div>
      </div>
      <div className={`w-full h-2 rounded-full overflow-hidden ${
        isDark ? "bg-slate-700" : "bg-slate-200"
      }`}>
        <div
          className={`h-full transition-all duration-300 ${
            percentage === 100
              ? "bg-green-500"
              : percentage >= 50
              ? "bg-blue-500"
              : "bg-amber-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </OBDPanel>
  );
}

