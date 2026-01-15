"use client";

import { useEffect, useMemo, useState } from "react";
import type { PageSections } from "../types";

function buttonClasses(isDark: boolean, variant: "primary" | "neutral" | "danger") {
  if (variant === "primary") return "bg-[#29c4a9] text-white hover:opacity-95";
  if (variant === "danger") {
    return isDark
      ? "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600"
      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200";
  }
  return isDark
    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
    : "bg-slate-100 text-slate-700 hover:bg-slate-200";
}

const SECTION_ORDER: Array<keyof PageSections> = [
  "hero",
  "intro",
  "services",
  "whyChooseUs",
  "areasServed",
  "closingCta",
];

const SECTION_LABELS: Record<keyof PageSections, string> = {
  hero: "Hero",
  intro: "Intro",
  services: "Services",
  whyChooseUs: "Why Choose Us",
  areasServed: "Areas Served",
  closingCta: "Closing CTA",
};

export default function PageSectionsEditor({
  isDark,
  activeSections,
  generatedSections,
  isEdited,
  onSave,
  onReset,
}: {
  isDark: boolean;
  activeSections: PageSections | undefined;
  generatedSections: PageSections | undefined;
  isEdited: boolean;
  onSave: (next: PageSections) => void;
  onReset: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PageSections | null>(activeSections ?? null);

  useEffect(() => {
    if (!isEditing) setDraft(activeSections ?? null);
  }, [activeSections, isEditing]);

  const canReset = useMemo(() => !!generatedSections && isEdited, [generatedSections, isEdited]);

  if (!activeSections) {
    return (
      <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Generate content to view/edit page sections.
      </div>
    );
  }

  const view = activeSections;
  const edit = draft ?? activeSections;

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
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(view);
                  setIsEditing(true);
                }}
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
                title={!generatedSections ? "Generate first" : !isEdited ? "No edits to reset" : "Reset to generated"}
              >
                Reset
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (!draft) return;
                  onSave(draft);
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
                  setDraft(view);
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
        <div className="space-y-4">
          {SECTION_ORDER.map((key) => (
            <div key={key}>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                {SECTION_LABELS[key]}
              </label>
              <textarea
                value={edit[key]}
                onChange={(e) => setDraft({ ...(draft ?? view), [key]: e.target.value })}
                rows={4}
                className={`w-full rounded-lg border px-3 py-2 text-sm font-mono whitespace-pre-wrap ${
                  isDark
                    ? "bg-slate-900/40 border-slate-700 text-slate-100"
                    : "bg-white border-slate-200 text-slate-900"
                }`}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {SECTION_ORDER.map((key) => (
            <div key={key} className="space-y-1">
              <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {SECTION_LABELS[key]}
              </p>
              <div className="whitespace-pre-wrap">{view[key]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


