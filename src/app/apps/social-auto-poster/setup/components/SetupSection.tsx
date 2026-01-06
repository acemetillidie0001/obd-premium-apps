"use client";

import OBDPanel from "@/components/obd/OBDPanel";

interface SetupSectionProps {
  title: string;
  subtitle?: string;
  required?: boolean;
  complete?: boolean;
  children: React.ReactNode;
  isDark: boolean;
}

/**
 * SetupSection Component
 * 
 * Displays a section header with optional "Required" label and "Complete" pill.
 */
export default function SetupSection({
  title,
  subtitle,
  required = false,
  complete = false,
  children,
  isDark,
}: SetupSectionProps) {
  return (
    <OBDPanel isDark={isDark} className="mb-6">
      <div className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className={`text-lg font-semibold ${isDark ? "text-slate-200" : "text-slate-900"}`}>
            {title}
          </h3>
          {required && (
            <span className={`px-2 py-0.5 text-xs rounded-full border ${
              isDark
                ? "bg-slate-700/50 text-slate-400 border-slate-600"
                : "bg-slate-100 text-slate-600 border-slate-300"
            }`}>
              Required
            </span>
          )}
          {complete && (
            <span className={`px-2 py-0.5 text-xs rounded-full border ${
              isDark
                ? "bg-green-500/20 text-green-400 border-green-500"
                : "bg-green-50 text-green-700 border-green-300"
            }`}>
              ✓ Complete
            </span>
          )}
        </div>
        {subtitle && (
          <p className={`text-sm mt-2 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </OBDPanel>
  );
}

