"use client";

import OBDHeading from "@/components/obd/OBDHeading";

/**
 * OBDAccordionSection
 *
 * Tier-5 accordion wrapper pattern (ported from Local SEO Page Builder)
 * - Collapsed state shows a one-line summary
 * - Expand/Collapse button on the right
 */
export default function OBDAccordionSection({
  isDark,
  title,
  titleRight,
  summary,
  isOpen,
  onToggle,
  children,
}: {
  isDark: boolean;
  title: string;
  titleRight?: React.ReactNode;
  summary?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border ${
        isDark ? "border-slate-700 bg-slate-800/40" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <OBDHeading level={2} isDark={isDark} className="!text-sm !mb-0">
              {title}
            </OBDHeading>
            {titleRight ? <div className="flex-shrink-0">{titleRight}</div> : null}
          </div>
          {!isOpen && summary ? (
            <p
              className={`text-xs mt-1 truncate ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
              title={summary}
            >
              {summary}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
            isDark
              ? "border-slate-600 text-slate-300 hover:bg-slate-700"
              : "border-slate-300 text-slate-600 hover:bg-slate-100"
          }`}
        >
          {isOpen ? "Collapse" : "Expand"}
        </button>
      </div>
      {isOpen ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}


