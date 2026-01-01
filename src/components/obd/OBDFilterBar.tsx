"use client";

import OBDPanel from "@/components/obd/OBDPanel";

/**
 * OBDFilterBar - Wrap-friendly filter/control row component
 * 
 * A flexible container for search inputs, dropdowns, pills, and toggles
 * that stacks nicely on mobile and stays one row on desktop when possible.
 * Supports optional sticky positioning with backdrop blur.
 * 
 * @example
 * <OBDFilterBar sticky={true} isDark={isDark} className="mt-6">
 *   <select>...</select>
 *   <input type="text" />
 *   <button>Filter</button>
 * </OBDFilterBar>
 */
export default function OBDFilterBar({
  children,
  isDark = false,
  sticky = false,
  topOffset = "0",
  className = "",
  usePanel = true,
}: {
  children: React.ReactNode;
  isDark?: boolean;
  sticky?: boolean;
  topOffset?: string | number;
  className?: string;
  usePanel?: boolean;
}) {
  const topValue = typeof topOffset === "number" ? `${topOffset}px` : topOffset;
  
  // Layout classes: flex with responsive wrapping
  const layoutClasses = "w-full min-w-0 flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap gap-3 items-start md:items-center";
  
  // Sticky wrapper classes (same visual rules as OBDStickyToolbar)
  const bgClass = isDark 
    ? "bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50"
    : "bg-white/95 backdrop-blur-sm border-b border-slate-200/50";
  
  const stickyClasses = sticky 
    ? `sticky z-30 ${bgClass}`
    : "";
  
  const stickyStyle = sticky ? { top: topValue } : undefined;
  
  const content = (
    <div className={layoutClasses}>
      {children}
    </div>
  );
  
  // Sticky mode: wrap in sticky container
  if (sticky) {
    return (
      <div 
        className={`w-full min-w-0 ${stickyClasses} ${className}`}
        style={stickyStyle}
      >
        {usePanel ? (
          <OBDPanel isDark={isDark} variant="toolbar" className="border-0 shadow-none rounded-none">
            {content}
          </OBDPanel>
        ) : (
          <div className="px-4 py-3 md:px-5 md:py-4">
            {content}
          </div>
        )}
      </div>
    );
  }
  
  // Non-sticky: use panel if requested, otherwise just the layout container
  if (usePanel) {
    return (
      <OBDPanel isDark={isDark} variant="toolbar" className={className}>
        {content}
      </OBDPanel>
    );
  }
  
  return (
    <div className={`${layoutClasses} ${className}`}>
      {children}
    </div>
  );
}

