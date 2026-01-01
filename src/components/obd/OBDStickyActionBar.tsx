"use client";

/**
 * OBDStickyActionBar - Sticky bottom action bar for form-based apps
 * 
 * Provides a sticky positioned container at the bottom of the viewport
 * for primary action buttons (Generate, Save, Export, etc.).
 * Mobile-friendly with safe area support and responsive layout.
 * 
 * @example
 * <OBDStickyActionBar isDark={isDark}>
 *   <button type="submit">Generate</button>
 *   <button>Export</button>
 * </OBDStickyActionBar>
 * 
 * // Don't forget to add bottom padding to content wrapper:
 * <div className={`space-y-6 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
 *   ...form fields...
 * </div>
 */

/**
 * Standard offset class to add to form content wrappers when using OBDStickyActionBar.
 * Prevents the sticky action bar from covering the last form fields.
 */
export const OBD_STICKY_ACTION_BAR_OFFSET_CLASS = "pb-24";

export default function OBDStickyActionBar({
  children,
  left,
  isDark = false,
  className = "",
  topBorder = true,
  safeArea = true,
}: {
  children: React.ReactNode;
  left?: React.ReactNode;
  isDark?: boolean;
  className?: string;
  topBorder?: boolean;
  safeArea?: boolean;
}) {
  // Background classes - theme-aware
  const bgClass = isDark 
    ? "bg-slate-950/90 backdrop-blur-sm"
    : "bg-white/90 backdrop-blur-sm";
  
  // Border class
  const borderClass = topBorder 
    ? (isDark ? "border-t border-slate-800/60" : "border-t border-slate-200/60")
    : "";
  
  // Safe area padding
  const safeAreaClass = safeArea ? "pb-[env(safe-area-inset-bottom)]" : "";
  
  return (
    <div 
      className={`w-full min-w-0 sticky bottom-0 z-30 ${bgClass} ${borderClass} ${safeAreaClass} ${className}`}
    >
      {left ? (
        <div className="w-full min-w-0 flex items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">{left}</div>
          <div className="flex flex-wrap justify-end gap-2">{children}</div>
        </div>
      ) : (
        <div className="w-full min-w-0 flex flex-wrap gap-2 items-center justify-end px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

