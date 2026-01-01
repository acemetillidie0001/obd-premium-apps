"use client";

/**
 * OBDResultsActions - Shared action buttons component for results panels
 * 
 * Standardizes common action buttons (Copy, Download, Clear) used in OBDResultsPanel headers.
 * Provides consistent styling and layout across apps.
 * 
 * @example
 * <OBDResultsActions
 *   isDark={isDark}
 *   onCopy={() => handleCopy()}
 *   onDownloadTxt={() => handleDownload()}
 *   extra={
 *     <button onClick={handleRegenerate}>Regenerate</button>
 *   }
 * />
 */
export default function OBDResultsActions({
  isDark = false,
  onCopy,
  onDownloadTxt,
  onClear,
  extra,
  disabled = false,
  copied = false,
}: {
  isDark?: boolean;
  onCopy?: () => void;
  onDownloadTxt?: () => void;
  onClear?: () => void;
  extra?: React.ReactNode;
  disabled?: boolean;
  copied?: boolean;
}) {
  const buttonBaseClasses = `px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
    isDark
      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
  }`;

  return (
    <div className="flex flex-wrap gap-2 lg:flex-nowrap lg:items-center">
      {onCopy && (
        <button
          onClick={onCopy}
          disabled={disabled}
          className={buttonBaseClasses}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
      {onDownloadTxt && (
        <button
          onClick={onDownloadTxt}
          disabled={disabled}
          className={buttonBaseClasses}
        >
          Download .txt
        </button>
      )}
      {onClear && (
        <button
          onClick={onClear}
          disabled={disabled}
          className={buttonBaseClasses}
        >
          Clear
        </button>
      )}
      {extra}
    </div>
  );
}

