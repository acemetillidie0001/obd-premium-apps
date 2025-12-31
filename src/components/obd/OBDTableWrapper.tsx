"use client";

/**
 * OBDTableWrapper - Standardized table wrapper for horizontal scrolling
 * 
 * Ensures tables scroll horizontally within their container without causing
 * page-level horizontal scrolling. Use this wrapper around all tables that
 * may exceed their container width.
 * 
 * @example
 * <OBDTableWrapper>
 *   <table className="text-sm">
 *     <thead>...</thead>
 *     <tbody>...</tbody>
 *   </table>
 * </OBDTableWrapper>
 */
export default function OBDTableWrapper({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="min-w-max">
        {children}
      </div>
    </div>
  );
}

