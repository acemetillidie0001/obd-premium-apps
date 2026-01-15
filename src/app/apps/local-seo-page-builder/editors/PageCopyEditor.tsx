"use client";

import { useEffect, useMemo, useState } from "react";

function buttonClasses(isDark: boolean, variant: "primary" | "neutral" | "danger") {
  if (variant === "primary") {
    return "bg-[#29c4a9] text-white hover:opacity-95";
  }
  if (variant === "danger") {
    return isDark
      ? "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600"
      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200";
  }
  return isDark
    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
    : "bg-slate-100 text-slate-700 hover:bg-slate-200";
}

export default function PageCopyEditor({
  isDark,
  activeValue,
  generatedValue,
  isEdited,
  onSave,
  onReset,
}: {
  isDark: boolean;
  activeValue: string;
  generatedValue: string | null;
  isEdited: boolean;
  onSave: (next: string) => void;
  onReset: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(activeValue);

  // Keep the textarea in sync if the active content changes while not editing (e.g., generate/regenerate).
  useEffect(() => {
    if (!isEditing) setDraftText(activeValue);
  }, [activeValue, isEditing]);

  const canReset = useMemo(() => !!generatedValue && isEdited, [generatedValue, isEdited]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {isEdited ? (
            <span
              className={`text-[10px] uppercase font-semibold px-2 py-1 rounded-lg border ${
                isDark
                  ? "bg-amber-900/30 text-amber-200 border-amber-800/50"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              Edited
            </span>
          ) : null}
          <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Inline edits override generated output until reset.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${buttonClasses(
                  isDark,
                  "neutral"
                )}`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  onReset();
                  setIsEditing(false);
                }}
                disabled={!canReset}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonClasses(
                  isDark,
                  "danger"
                )}`}
                title={!generatedValue ? "Generate first" : !isEdited ? "No edits to reset" : "Reset to generated"}
              >
                Reset
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  onSave(draftText);
                  setIsEditing(false);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${buttonClasses(
                  isDark,
                  "primary"
                )}`}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftText(activeValue);
                  setIsEditing(false);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${buttonClasses(
                  isDark,
                  "neutral"
                )}`}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          rows={10}
          className={`w-full rounded-lg border p-3 text-sm font-mono whitespace-pre-wrap ${
            isDark
              ? "bg-slate-900/40 border-slate-700 text-slate-100"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        />
      ) : (
        <div className="whitespace-pre-wrap">{activeValue}</div>
      )}
    </div>
  );
}


