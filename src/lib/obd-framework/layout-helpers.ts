/**
 * OBD V3 App Framework - Layout Helpers
 * 
 * Shared utility functions for page layout, panel styles, container widths, etc.
 */

/**
 * Standard container width class (full-width with responsive padding)
 */
export const CONTAINER_WIDTH = "w-full px-4 sm:px-6 lg:px-8 py-10";

/**
 * Full-width container class (for apps that need full viewport width)
 */
export const CONTAINER_WIDTH_FULL = "w-full max-w-none px-4 sm:px-6 lg:px-8 py-10";

/**
 * Constrained container width class (max-w-6xl with centered alignment)
 */
export const CONTAINER_WIDTH_CONSTRAINED = "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10";

/**
 * Standard sidebar width class
 */
export const SIDEBAR_WIDTH = "lg:w-72 lg:sticky lg:top-28 self-start mb-8 lg:mb-0";

/**
 * Standard page background class
 */
export function getPageBackground(isDark: boolean): string {
  return `${isDark ? "bg-slate-950" : "bg-slate-50"} min-h-[calc(100vh-64px)] transition-colors`;
}

/**
 * Standard divider class
 */
export function getDividerClass(isDark: boolean): string {
  return `border-t ${isDark ? "border-slate-700" : "border-slate-200"}`;
}

/**
 * Standard breadcrumb link classes
 */
export function getBreadcrumbClasses(isDark: boolean): string {
  return `inline-flex items-center transition-colors ${
    isDark ? "text-sky-400 hover:text-sky-300" : "text-sky-500 hover:text-sky-600"
  }`;
}

/**
 * Standard error message panel classes
 */
export function getErrorPanelClasses(isDark: boolean): string {
  return `rounded-xl border p-3 ${
    isDark
      ? "bg-red-900/20 border-red-700 text-red-400"
      : "bg-red-50 border-red-200 text-red-600"
  }`;
}

/**
 * Standard submit button classes
 */
export const SUBMIT_BUTTON_CLASSES =
  "w-full px-6 py-3 bg-[#29c4a9] text-white font-medium rounded-full hover:bg-[#22ad93] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Standard table wrapper classes for horizontal scrolling
 * Use: <div className={TABLE_WRAPPER}><div className="min-w-max"><table>...</table></div></div>
 */
export const TABLE_WRAPPER = "overflow-x-auto";

