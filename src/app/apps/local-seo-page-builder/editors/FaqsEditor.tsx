"use client";

import { useEffect, useMemo, useState } from "react";
import type { FAQItem } from "../types";

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

function normalizeFaqs(input: FAQItem[]): FAQItem[] {
  // Ensure exactly 6 items (pad/truncate) to match server behavior.
  const safe = Array.isArray(input) ? input : [];
  const out = safe.slice(0, 6).map((x) => ({
    question: typeof x.question === "string" ? x.question : "",
    answer: typeof x.answer === "string" ? x.answer : "",
  }));
  while (out.length < 6) out.push({ question: "", answer: "" });
  return out;
}

export default function FaqsEditor({
  isDark,
  activeFaqs,
  generatedFaqs,
  isEdited,
  onSave,
  onReset,
}: {
  isDark: boolean;
  activeFaqs: FAQItem[];
  generatedFaqs: FAQItem[] | null;
  isEdited: boolean;
  onSave: (next: FAQItem[]) => void;
  onReset: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftFaqs, setDraftFaqs] = useState<FAQItem[]>(normalizeFaqs(activeFaqs));

  useEffect(() => {
    if (!isEditing) setDraftFaqs(normalizeFaqs(activeFaqs));
  }, [activeFaqs, isEditing]);

  const canReset = useMemo(() => !!generatedFaqs && isEdited, [generatedFaqs, isEdited]);

  if (!activeFaqs || activeFaqs.length === 0) {
    return (
      <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Generate content to view/edit FAQs.
      </div>
    );
  }

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
            Exactly 6 FAQs are expected.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraftFaqs(normalizeFaqs(activeFaqs));
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
                title={!generatedFaqs ? "Generate first" : !isEdited ? "No edits to reset" : "Reset to generated"}
              >
                Reset
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  onSave(normalizeFaqs(draftFaqs));
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
                  setDraftFaqs(normalizeFaqs(activeFaqs));
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
          {draftFaqs.map((faq, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${
                isDark ? "border-slate-700 bg-slate-900/20" : "border-slate-200 bg-white"
              }`}
            >
              <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Q{idx + 1}
              </label>
              <input
                value={faq.question}
                onChange={(e) => {
                  const next = [...draftFaqs];
                  next[idx] = { ...next[idx], question: e.target.value };
                  setDraftFaqs(next);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${
                  isDark
                    ? "bg-slate-900/40 border-slate-700 text-slate-100"
                    : "bg-white border-slate-200 text-slate-900"
                }`}
              />
              <label className={`block text-xs font-semibold mt-3 mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                A{idx + 1}
              </label>
              <textarea
                value={faq.answer}
                onChange={(e) => {
                  const next = [...draftFaqs];
                  next[idx] = { ...next[idx], answer: e.target.value };
                  setDraftFaqs(next);
                }}
                rows={3}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${
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
          {activeFaqs.map((faq, idx) => (
            <div
              key={idx}
              className="p-3 rounded border border-slate-300 dark:border-slate-600"
            >
              <p className="font-semibold mb-2">Q: {faq.question}</p>
              <p className="text-sm">{faq.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


