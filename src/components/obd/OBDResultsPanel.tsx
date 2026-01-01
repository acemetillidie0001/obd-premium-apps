"use client";

import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStatusBlock from "@/components/obd/OBDStatusBlock";
import { getThemeClasses } from "@/lib/obd-framework/theme";

/**
 * OBDResultsPanel - Shared results panel component for generated output
 * 
 * Provides a consistent layout for displaying AI-generated results across apps.
 * Includes header with title/subtitle, action buttons, loading states, and empty states.
 * 
 * @example
 * <OBDResultsPanel
 *   title="Generated Posts"
 *   isDark={isDark}
 *   actions={
 *     <>
 *       <button>Regenerate</button>
 *       <button>Copy</button>
 *     </>
 *   }
 *   loading={loading}
 *   emptyState={<p>No results yet</p>}
 * >
 *   ...results content...
 * </OBDResultsPanel>
 */
export default function OBDResultsPanel({
  title,
  subtitle,
  isDark = false,
  actions,
  children,
  emptyState,
  loading = false,
  loadingText,
  emptyTitle,
  emptyDescription,
  className = "",
}: {
  title: string;
  subtitle?: string;
  isDark?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  emptyState?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  const themeClasses = getThemeClasses(isDark);
  
  return (
    <OBDPanel isDark={isDark} className={className}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="min-w-0">
          <OBDHeading level={2} isDark={isDark}>
            {title}
          </OBDHeading>
          {subtitle && (
            <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2 lg:flex-nowrap lg:items-center lg:shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Body */}
      {loading ? (
        loadingText ? (
          <OBDStatusBlock
            variant="loading"
            title={loadingText}
            isDark={isDark}
          />
        ) : (
          <div className="flex items-center justify-center h-32">
            <div className={themeClasses.mutedText}>Generating...</div>
          </div>
        )
      ) : !children && (emptyState || emptyTitle) ? (
        emptyState ? (
          <div className="py-8">
            {emptyState}
          </div>
        ) : (
          <OBDStatusBlock
            variant="empty"
            title={emptyTitle || "No results"}
            description={emptyDescription}
            isDark={isDark}
          />
        )
      ) : (
        children
      )}
    </OBDPanel>
  );
}

