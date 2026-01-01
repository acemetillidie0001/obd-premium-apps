"use client";

/**
 * OBDStickyToolbar - Sticky toolbar wrapper with backdrop blur
 * 
 * Provides a sticky positioned container with backdrop blur and subtle border
 * for toolbar/controls sections. Theme-aware styling for light/dark modes.
 * 
 * @example
 * <OBDStickyToolbar isDark={isDark}>
 *   <OBDToolbarRow left={...} right={...} />
 * </OBDStickyToolbar>
 */
export default function OBDStickyToolbar({
  children,
  isDark,
  className = "",
  topOffset = "0",
}: {
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
  topOffset?: string | number;
}) {
  const topValue = typeof topOffset === "number" ? `${topOffset}px` : topOffset;
  const bgClass = isDark 
    ? "bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50"
    : "bg-white/95 backdrop-blur-sm border-b border-slate-200/50";
  
  return (
    <div
      className={`w-full min-w-0 sticky z-30 ${bgClass} ${className}`}
      style={{ top: topValue }}
    >
      {children}
    </div>
  );
}

