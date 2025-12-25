"use client";

import { useState } from "react";
import { getThemeClasses } from "@/lib/obd-framework/theme";

interface LocalKeywordLegendProps {
  isDark: boolean;
  className?: string;
}

interface TooltipButtonProps {
  id: string;
  label: string;
  content: string;
  isDark: boolean;
  hoveredTooltip: string | null;
  setHoveredTooltip: (id: string | null) => void;
}

const TooltipButton = ({ 
  id, 
  label, 
  content,
  isDark,
  hoveredTooltip,
  setHoveredTooltip
}: TooltipButtonProps) => (
    <div className="relative inline-block">
      <button
        type="button"
        aria-label={`${label} info`}
        onMouseEnter={() => setHoveredTooltip(id)}
        onMouseLeave={() => setHoveredTooltip(null)}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] transition-colors ${
          isDark
            ? "border-slate-600 text-slate-400 hover:bg-slate-700 hover:border-slate-500"
            : "border-slate-300 text-slate-500 hover:bg-slate-100 hover:border-slate-400"
        }`}
      >
        ℹ
      </button>
      {hoveredTooltip === id && (
        <div
          className={`absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border p-2 text-xs shadow-lg ${
            isDark
              ? "bg-slate-800 border-slate-700 text-slate-200"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          <p>{content}</p>
          <div
            className={`absolute top-full left-1/2 -translate-x-1/2 border-4 ${
              isDark
                ? "border-t-slate-800"
                : "border-t-white"
            }`}
          />
        </div>
      )}
    </div>
  );

export function LocalKeywordLegend({ isDark, className = "" }: LocalKeywordLegendProps) {
  const themeClasses = getThemeClasses(isDark);
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  return (
    <div
      className={`mb-4 rounded-2xl border p-4 text-xs md:text-sm ${
        isDark
          ? "bg-slate-800/50 border-slate-700"
          : "bg-slate-50/50 border-slate-200"
      } ${className}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${themeClasses.mutedText}`}>
          Keyword Strategy Legend
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Difficulty */}
        <div>
          <div className="mb-1 flex items-center gap-1">
            <span className={`font-semibold ${themeClasses.headingText}`}>Difficulty</span>
            <TooltipButton
              id="difficulty"
              label="Difficulty"
              content="A quick signal of how hard it is for a small local business to rank for this keyword."
              isDark={isDark}
              hoveredTooltip={hoveredTooltip}
              setHoveredTooltip={setHoveredTooltip}
            />
          </div>
          <ul className={`space-y-1 text-[11px] md:text-xs ${themeClasses.labelText}`}>
            <li className="flex items-center gap-1.5">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                <span className="font-semibold">Easy</span> — realistic to rank with strong local pages.
              </span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
              <span>
                <span className="font-semibold">Medium</span> — needs good content & some authority.
              </span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
              <span>
                <span className="font-semibold">Hard</span> — heavy competition or very generic term.
              </span>
            </li>
          </ul>
        </div>

        {/* Opportunity Score */}
        <div>
          <div className="mb-1 flex items-center gap-1">
            <span className={`font-semibold ${themeClasses.headingText}`}>Opportunity Score (1–100)</span>
            <TooltipButton
              id="opportunity"
              label="Opportunity Score"
              content="A combined score that balances demand, local intent, and difficulty. Higher = better priority to work on."
              isDark={isDark}
              hoveredTooltip={hoveredTooltip}
              setHoveredTooltip={setHoveredTooltip}
            />
          </div>
          <ul className={`space-y-1 text-[11px] md:text-xs ${themeClasses.labelText}`}>
            <li>
              <span className="font-semibold">80–100</span> — top-priority, &quot;work on these first&quot;.
            </li>
            <li>
              <span className="font-semibold">60–79</span> — strong secondary targets.
            </li>
            <li>
              <span className="font-semibold">40–59</span> — nice-to-have supporting phrases.
            </li>
          </ul>
        </div>

        {/* Intent Types */}
        <div>
          <div className="mb-1 flex items-center gap-1">
            <span className={`font-semibold ${themeClasses.headingText}`}>Intent types</span>
            <TooltipButton
              id="intent"
              label="Intent Types"
              content="Intent tells you what the searcher is trying to do, so you can match the right content or page type."
              isDark={isDark}
              hoveredTooltip={hoveredTooltip}
              setHoveredTooltip={setHoveredTooltip}
            />
          </div>
          <ul className={`space-y-1 text-[11px] md:text-xs ${themeClasses.labelText}`}>
            <li>
              <span className="font-semibold">Transactional</span> — ready to book, call, or buy.
            </li>
            <li>
              <span className="font-semibold">Informational</span> — researching, learning, asking questions.
            </li>
            <li>
              <span className="font-semibold">Local</span> — contains city, area, or &quot;near me&quot; phrasing.
            </li>
            <li>
              <span className="font-semibold">Commercial</span> — comparing options, &quot;best&quot;, &quot;top&quot;, etc.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

