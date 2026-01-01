"use client";

import { getThemeClasses } from "@/lib/obd-framework/theme";

/**
 * OBDStatusBlock - Shared status block component for empty/loading/error/success states
 * 
 * Provides consistent styling and layout for status messages across apps.
 * Supports empty, loading, error, and success variants.
 * 
 * @example
 * <OBDStatusBlock
 *   variant="empty"
 *   title="No results yet"
 *   description="Fill out the form to generate content"
 *   isDark={isDark}
 * />
 * 
 * @example
 * <OBDStatusBlock
 *   variant="error"
 *   title="Error"
 *   description="Something went wrong"
 *   isDark={isDark}
 * />
 */
export default function OBDStatusBlock({
  variant,
  title,
  description,
  icon,
  actions,
  isDark = false,
  className = "",
}: {
  variant: "empty" | "loading" | "error" | "success";
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  isDark?: boolean;
  className?: string;
}) {
  const themeClasses = getThemeClasses(isDark);
  
  // Default icons per variant
  const defaultIcon = !icon ? (
    variant === "empty" ? (
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
        isDark ? "bg-slate-800" : "bg-slate-100"
      }`}>
        <span className="text-2xl">📄</span>
      </div>
    ) : variant === "loading" ? (
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
        isDark ? "bg-slate-800" : "bg-slate-100"
      }`}>
        <svg className="animate-spin h-6 w-6 text-[#29c4a9]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    ) : variant === "error" ? (
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
        isDark ? "bg-red-900/20" : "bg-red-50"
      }`}>
        <span className="text-2xl">⚠️</span>
      </div>
    ) : (
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
        isDark ? "bg-green-900/20" : "bg-green-50"
      }`}>
        <span className="text-2xl">✓</span>
      </div>
    )
  ) : icon;

  // Variant-specific styling
  const containerClasses = variant === "error"
    ? `rounded-xl border p-5 ${
        isDark 
          ? "bg-red-900/10 border-red-800/50" 
          : "bg-red-50 border-red-200"
      }`
    : variant === "success"
    ? `rounded-xl border p-5 ${
        isDark 
          ? "bg-green-900/10 border-green-800/50" 
          : "bg-green-50 border-green-200"
      }`
    : `rounded-xl border p-5 ${
        isDark 
          ? "bg-slate-800/30 border-slate-700" 
          : "bg-slate-50 border-slate-200"
      }`;

  const titleClasses = variant === "error"
    ? `text-base font-semibold mb-2 ${isDark ? "text-red-300" : "text-red-800"}`
    : variant === "success"
    ? `text-base font-semibold mb-2 ${isDark ? "text-green-300" : "text-green-800"}`
    : `text-base font-semibold mb-2 ${themeClasses.headingText}`;

  const descriptionClasses = variant === "error"
    ? `text-sm ${isDark ? "text-red-200" : "text-red-700"}`
    : variant === "success"
    ? `text-sm ${isDark ? "text-green-200" : "text-green-700"}`
    : `text-sm ${themeClasses.mutedText}`;

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="flex flex-col items-center text-center">
        {defaultIcon && (
          <div className="mb-4">
            {defaultIcon}
          </div>
        )}
        <h3 className={titleClasses}>
          {title}
        </h3>
        {description && (
          <p className={descriptionClasses}>
            {description}
          </p>
        )}
        {actions && (
          <div className="mt-4 flex gap-2 justify-center flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

