"use client";

import { getThemeClasses } from "@/lib/obd-framework/theme";

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  const theme = getThemeClasses(isDark);

  return (
    <div className="mt-6 flex justify-center">
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium shadow-sm transition ${
          isDark
            ? "border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-800"
            : "border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: "#29c4a9" }}
        />
        {isDark ? "Dark Mode On — Switch to Light" : "Light Mode On — Switch to Dark"}
      </button>
    </div>
  );
}

