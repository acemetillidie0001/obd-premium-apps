/**
 * OBD V3 App Framework - Theme Utilities
 * 
 * Provides theme state management and class helpers for consistent theming
 * across all OBD apps.
 */

export type Theme = "light" | "dark";

/**
 * Theme-aware class utilities
 */
export interface ThemeClasses {
  pageBg: string;
  panelBg: string;
  panelBorder: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  labelText: string;
  mutedText: string;
  headingText: string;
}

/**
 * Get theme-aware CSS classes based on theme mode
 */
export function getThemeClasses(isDark: boolean): ThemeClasses {
  return {
    pageBg: isDark ? "bg-slate-950" : "bg-slate-50",
    panelBg: isDark ? "bg-slate-900" : "bg-white",
    panelBorder: isDark ? "border-slate-700" : "border-slate-200",
    inputBg: isDark ? "bg-slate-800" : "bg-white",
    inputBorder: isDark ? "border-slate-700" : "border-slate-300",
    inputText: isDark ? "text-slate-50" : "text-slate-900",
    labelText: isDark ? "text-slate-200" : "text-slate-700",
    mutedText: isDark ? "text-slate-300" : "text-slate-600",
    headingText: isDark ? "text-white" : "text-slate-900",
  };
}

/**
 * Get panel styling classes (for form panels and output panels)
 */
export function getPanelClasses(isDark: boolean): string {
  return `w-full rounded-3xl border px-6 py-6 md:px-8 md:py-7 transition-shadow ${
    isDark
      ? "bg-slate-900/80 border-slate-700 shadow-lg"
      : "bg-white border-slate-200 shadow-md shadow-slate-300/60 hover:shadow-lg hover:shadow-slate-400/70"
  }`;
}

/**
 * Get input field styling classes
 */
export function getInputClasses(
  isDark: boolean,
  additionalClasses?: string
): string {
  const theme = getThemeClasses(isDark);
  // P2-12: Enhanced focus indicators with focus-visible for keyboard navigation
  return `w-full px-4 py-2 border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} rounded-xl focus-visible:ring-2 focus-visible:ring-[#29c4a9] focus-visible:border-transparent outline-none ${additionalClasses || ""}`;
}

