"use client";

import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { getSubtleButtonSmallClasses } from "@/lib/obd-framework/layout-helpers";
import type { CaptionItem } from "@/app/apps/image-caption-generator/types";

interface CaptionCardProps {
  caption: CaptionItem;
  isSelected: boolean;
  onToggleSelected: (id: string) => void;
  onCopy: (id: string) => void;
  onEdit?: (id: string) => void; // Optional edit handler
  isDark: boolean;
  copiedId: string | null;
}

/**
 * CaptionCard - Reusable caption card component with selection support
 * 
 * Displays a single caption with platform chips, selection toggle, and copy action.
 * Maintains consistent styling with OBD suite panels/buttons.
 */
export default function CaptionCard({
  caption,
  isSelected,
  onToggleSelected,
  onCopy,
  onEdit,
  isDark,
  copiedId,
}: CaptionCardProps) {
  const themeClasses = getThemeClasses(isDark);

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        isDark
          ? isSelected
            ? "bg-slate-800/70 border-[#29c4a9] hover:border-[#29c4a9]"
            : "bg-slate-800/50 border-slate-700 hover:border-[#29c4a9]"
          : isSelected
          ? "bg-blue-50/50 border-[#29c4a9] hover:border-[#29c4a9]"
          : "bg-white border-slate-200 hover:border-[#29c4a9]"
      }`}
    >
      {/* Top row with meta chips and action buttons */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-wrap gap-2">
          {/* Platform chip (required) */}
          <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
            isDark
              ? "bg-slate-700 text-slate-200"
              : "bg-slate-100 text-slate-700"
          }`}>
            {caption.platform}
          </span>
          
          {/* Optional chips for goal/length/tone if present */}
          {caption.goal && (
            <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${themeClasses.mutedText} ${
              isDark ? "bg-slate-700/50" : "bg-slate-100/50"
            }`}>
              {caption.goal}
            </span>
          )}
          
          {caption.length && (
            <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${themeClasses.mutedText} ${
              isDark ? "bg-slate-700/50" : "bg-slate-100/50"
            }`}>
              {caption.length}
            </span>
          )}
          
          {caption.tone && (
            <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${themeClasses.mutedText} ${
              isDark ? "bg-slate-700/50" : "bg-slate-100/50"
            }`}>
              {caption.tone}
            </span>
          )}
          
          {/* Display-only fields if present */}
          {caption.lengthMode && (
            <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${themeClasses.mutedText} ${
              isDark ? "bg-slate-700/50" : "bg-slate-100/50"
            }`}>
              {caption.lengthMode}
            </span>
          )}
          
          {caption.variationMode && (
            <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${themeClasses.mutedText} ${
              isDark ? "bg-slate-700/50" : "bg-slate-100/50"
            }`}>
              {caption.variationMode}
            </span>
          )}
        </div>
        
        {/* Actions row: Select toggle, Edit (if provided), and Copy button */}
        <div className="flex items-center gap-2">
          {/* Selection toggle checkbox */}
          <button
            onClick={() => onToggleSelected(caption.id)}
            className={`flex items-center justify-center w-5 h-5 rounded border transition-colors ${
              isSelected
                ? isDark
                  ? "bg-[#29c4a9] border-[#29c4a9]"
                  : "bg-[#29c4a9] border-[#29c4a9]"
                : isDark
                ? "bg-slate-700 border-slate-600 hover:border-slate-500"
                : "bg-white border-slate-300 hover:border-slate-400"
            }`}
            aria-label={isSelected ? "Deselect caption" : "Select caption"}
          >
            {isSelected && (
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7"></path>
              </svg>
            )}
          </button>
          
          {/* Edit button (optional) */}
          {onEdit && (
            <button
              onClick={() => onEdit(caption.id)}
              className={getSubtleButtonSmallClasses(isDark)}
            >
              Edit
            </button>
          )}
          
          {/* Copy button */}
          <button
            onClick={() => onCopy(caption.id)}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
              copiedId === caption.id
                ? isDark
                  ? "bg-[#29c4a9] text-white"
                  : "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {copiedId === caption.id ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Label (if present) */}
      {caption.label && (
        <h3 className={`font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
          {caption.label}
        </h3>
      )}

      {/* Preview hint (if present) */}
      {caption.previewHint && (
        <p className={`text-xs mb-3 ${themeClasses.mutedText}`}>
          {caption.previewHint}
        </p>
      )}

      {/* Caption text */}
      <div className={`text-sm leading-relaxed mb-3 whitespace-pre-line ${
        isDark ? "text-slate-200" : "text-slate-700"
      }`}>
        {caption.caption}
      </div>

      {/* Hashtags (if present) */}
      {caption.hashtags && caption.hashtags.length > 0 && (
        <div className={`pt-3 mt-3 border-t ${
          isDark ? "border-slate-700" : "border-slate-200"
        }`}>
          <p className={`text-xs ${themeClasses.mutedText}`}>
            {caption.hashtags.join(" ")}
          </p>
        </div>
      )}
    </div>
  );
}

