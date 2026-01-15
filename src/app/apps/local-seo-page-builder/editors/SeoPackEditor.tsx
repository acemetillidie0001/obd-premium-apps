"use client";

import { useEffect, useMemo, useState } from "react";
import type { SEOPack } from "../types";

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

export default function SeoPackEditor({
  isDark,
  activeSeoPack,
  generatedSeoPack,
  isEdited,
  onSave,
  onReset,
}: {
  isDark: boolean;
  activeSeoPack: SEOPack | undefined;
  generatedSeoPack: SEOPack | undefined;
  isEdited: boolean;
  onSave: (next: SEOPack) => void;
  onReset: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<SEOPack | null>(activeSeoPack ?? null);

  useEffect(() => {
    if (!isEditing) setDraft(activeSeoPack ?? null);
  }, [activeSeoPack, isEditing]);

  const canReset = useMemo(() => !!generatedSeoPack && isEdited, [generatedSeoPack, isEdited]);
  const canEdit = !!activeSeoPack;

  const lenClass = (len: number, max: number) => {
    if (len > max) return isDark ? "text-amber-300" : "text-amber-700";
    if (len > max * 0.9) return isDark ? "text-slate-300" : "text-slate-600";
    return isDark ? "text-slate-400" : "text-slate-500";
  };

  if (!activeSeoPack) {
    return (
      <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Generate content to view/edit the SEO pack.
      </div>
    );
  }

  const view = activeSeoPack;
  const edit = draft ?? activeSeoPack;
  const metaTitleLen = (isEditing ? edit.metaTitle : view.metaTitle).length;
  const metaDescLen = (isEditing ? edit.metaDescription : view.metaDescription).length;

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
                  if (!canEdit) return;
                  setDraft(view);
                  setIsEditing(true);
                }}
                disabled={!canEdit}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonClasses(
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
                title={!generatedSeoPack ? "Generate first" : !isEdited ? "No edits to reset" : "Reset to generated"}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              Meta Title
            </label>
            <input
              value={edit.metaTitle}
              onChange={(e) => setDraft({ ...(draft ?? view), metaTitle: e.target.value })}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                isDark
                  ? "bg-slate-900/40 border-slate-700 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            />
            <p className={`mt-1 text-[11px] ${lenClass(metaTitleLen, 60)}`}>
              {metaTitleLen}/60 (soft limit)
            </p>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              Slug
            </label>
            <input
              value={edit.slug}
              onChange={(e) => setDraft({ ...(draft ?? view), slug: e.target.value })}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-mono ${
                isDark
                  ? "bg-slate-900/40 border-slate-700 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            />
          </div>
          <div className="md:col-span-2">
            <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              Meta Description
            </label>
            <textarea
              value={edit.metaDescription}
              onChange={(e) => setDraft({ ...(draft ?? view), metaDescription: e.target.value })}
              rows={3}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                isDark
                  ? "bg-slate-900/40 border-slate-700 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            />
            <p className={`mt-1 text-[11px] ${lenClass(metaDescLen, 160)}`}>
              {metaDescLen}/160 (soft limit)
            </p>
          </div>
          <div className="md:col-span-2">
            <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              H1
            </label>
            <input
              value={edit.h1}
              onChange={(e) => setDraft({ ...(draft ?? view), h1: e.target.value })}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                isDark
                  ? "bg-slate-900/40 border-slate-700 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Meta Title
            </p>
            <p className="font-semibold">{view.metaTitle}</p>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Meta Description
            </p>
            <p className="text-sm">{view.metaDescription}</p>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Slug
            </p>
            <p className="font-mono text-sm">{view.slug}</p>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              H1
            </p>
            <p className="font-semibold text-lg">{view.h1}</p>
          </div>
        </div>
      )}
    </div>
  );
}


