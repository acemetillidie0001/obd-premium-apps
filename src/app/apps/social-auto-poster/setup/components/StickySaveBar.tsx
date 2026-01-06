"use client";

interface StickySaveBarProps {
  isDirty: boolean;
  canSave: boolean;
  onSave: () => void;
  isSaving?: boolean;
  helperText?: string;
  isDark: boolean;
}

/**
 * StickySaveBar Component
 * 
 * Sticky bottom bar for saving settings with dirty state indication.
 * Mobile-safe with padding to prevent covering controls.
 */
export default function StickySaveBar({
  isDirty,
  canSave,
  onSave,
  isSaving = false,
  helperText,
  isDark,
}: StickySaveBarProps) {
  const themeClasses = {
    bg: isDark ? "bg-slate-900" : "bg-white",
    border: isDark ? "border-slate-700" : "border-slate-200",
    text: isDark ? "text-slate-200" : "text-slate-900",
    muted: isDark ? "text-slate-400" : "text-slate-600",
    button: canSave && !isSaving
      ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
      : isDark
      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
      : "bg-slate-300 text-slate-500 cursor-not-allowed",
  };

  return (
    <>
      {/* Spacer to prevent content from being covered by sticky bar */}
      <div className="h-24" />
      
      {/* Sticky Save Bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 border-t ${themeClasses.bg} ${themeClasses.border} shadow-lg`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {isDirty && (
                <span className={`text-sm ${themeClasses.muted}`}>
                  Unsaved changes
                </span>
              )}
              {helperText && !canSave && (
                <span className={`text-sm ${themeClasses.muted}`}>
                  {helperText}
                </span>
              )}
            </div>
            <button
              onClick={onSave}
              disabled={!canSave || isSaving}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${themeClasses.button}`}
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

