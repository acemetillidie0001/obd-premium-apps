"use client";

/**
 * OBDToolbarRow - Standardized toolbar row layout
 * 
 * Enforces the proven CRM toolbar structure:
 * - Outer: flex with responsive layout (column on mobile, row on lg+)
 * - Left slot: flex-1 with wrapping on md, nowrap on lg
 * - Right slot: shrink-0 with wrapping on mobile, nowrap on lg+
 * 
 * @example
 * <OBDToolbarRow
 *   left={
 *     <>
 *       <input type="text" placeholder="Search..." />
 *       <select>...</select>
 *     </>
 *   }
 *   right={
 *     <>
 *       <button>Export</button>
 *       <button>Add</button>
 *     </>
 *   }
 * />
 */
export default function OBDToolbarRow({
  left,
  right,
  className = "",
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col lg:flex-row lg:flex-nowrap gap-3 lg:gap-4 items-start lg:items-center lg:justify-between ${className}`}>
      {/* Left Group: Search, Filters, Toggles */}
      <div className="flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap gap-3 flex-1 min-w-0 overflow-hidden">
        {left}
      </div>
      
      {/* Right Group: Actions (optional) */}
      {right && (
        <div className="flex flex-wrap gap-2 lg:flex-nowrap lg:items-center lg:shrink-0">
          {right}
        </div>
      )}
    </div>
  );
}

