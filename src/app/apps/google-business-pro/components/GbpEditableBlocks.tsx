"use client";

import { useMemo, useState } from "react";

type Tone = "default" | "muted";

function badgeClasses(isDark: boolean) {
  return isDark
    ? "bg-amber-500/15 text-amber-300 border border-amber-400/30"
    : "bg-amber-500/10 text-amber-700 border border-amber-500/30";
}

function buttonClasses(isDark: boolean, tone: Tone = "default") {
  if (tone === "muted") {
    return isDark
      ? "border-slate-600 text-slate-300 hover:bg-slate-700"
      : "border-slate-300 text-slate-600 hover:bg-slate-100";
  }
  return isDark
    ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
    : "bg-[#29c4a9] text-white hover:bg-[#24b09a]";
}

export function EditedBadge({ isDark }: { isDark: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${badgeClasses(isDark)}`}>
      Edited
    </span>
  );
}

export function EditableTextBlock({
  isDark,
  title,
  value,
  baseline,
  isEdited,
  extraActions,
  onSave,
  onResetToGenerated,
}: {
  isDark: boolean;
  title: string;
  value: string;
  baseline?: string;
  isEdited: boolean;
  extraActions?: React.ReactNode;
  onSave: (next: string) => void;
  onResetToGenerated?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const canReset = typeof onResetToGenerated === "function" && typeof baseline === "string";

  return (
    <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className={`text-sm font-semibold truncate ${isDark ? "text-slate-100" : "text-gray-900"}`}>
            {title}
          </h4>
          {isEdited ? <EditedBadge isDark={isDark} /> : null}
        </div>
        <div className="flex items-center gap-2">
          {extraActions ? <div className="flex items-center gap-2">{extraActions}</div> : null}
          {canReset ? (
            <button
              type="button"
              onClick={() => {
                onResetToGenerated?.();
                setIsEditing(false);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${buttonClasses(isDark, "muted")}`}
              title="Reset this block to generated"
            >
              Reset
            </button>
          ) : null}
          {!isEditing ? (
            <button
              type="button"
              onClick={() => {
                setDraft(value);
                setIsEditing(true);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${buttonClasses(isDark)}`}
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  onSave(draft);
                  setIsEditing(false);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${buttonClasses(isDark)}`}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(value);
                  setIsEditing(false);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${buttonClasses(isDark, "muted")}`}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {!isEditing ? (
        <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>{value}</p>
      ) : (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            isDark
              ? "bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500"
              : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"
          }`}
        />
      )}
    </div>
  );
}

export function EditableLinesBlock({
  isDark,
  title,
  value,
  baseline,
  isEdited,
  placeholder,
  extraActions,
  onSave,
  onResetToGenerated,
}: {
  isDark: boolean;
  title: string;
  value: string[];
  baseline?: string[];
  isEdited: boolean;
  placeholder?: string;
  extraActions?: React.ReactNode;
  onSave: (next: string[]) => void;
  onResetToGenerated?: () => void;
}) {
  const textValue = useMemo(() => (Array.isArray(value) ? value.join("\n") : ""), [value]);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(textValue);

  const canReset = typeof onResetToGenerated === "function" && Array.isArray(baseline);

  return (
    <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className={`text-sm font-semibold truncate ${isDark ? "text-slate-100" : "text-gray-900"}`}>{title}</h4>
          {isEdited ? <EditedBadge isDark={isDark} /> : null}
        </div>
        <div className="flex items-center gap-2">
          {extraActions ? <div className="flex items-center gap-2">{extraActions}</div> : null}
          {canReset ? (
            <button
              type="button"
              onClick={() => {
                onResetToGenerated?.();
                setIsEditing(false);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${buttonClasses(isDark, "muted")}`}
            >
              Reset
            </button>
          ) : null}
          {!isEditing ? (
            <button
              type="button"
              onClick={() => {
                setDraft(textValue);
                setIsEditing(true);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${buttonClasses(isDark)}`}
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  const next = draft
                    .split(/\r?\n/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  onSave(next);
                  setIsEditing(false);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${buttonClasses(isDark)}`}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(textValue);
                  setIsEditing(false);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${buttonClasses(isDark, "muted")}`}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {!isEditing ? (
        <ul className={`space-y-1 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
          {value.length > 0 ? value.map((line, idx) => <li key={idx} className="text-sm">• {line}</li>) : (
            <li className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>No items</li>
          )}
        </ul>
      ) : (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          placeholder={placeholder}
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            isDark
              ? "bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500"
              : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"
          }`}
        />
      )}
    </div>
  );
}

export type FaqItem = { question: string; answer: string };

function faqsToText(faqs: FaqItem[]): string {
  if (!Array.isArray(faqs) || faqs.length === 0) return "";
  return faqs
    .map((f) => `Q: ${f.question}\nA: ${f.answer}`.trim())
    .join("\n\n");
}

function parseFaqsFromText(text: string): FaqItem[] {
  const raw = (text || "").trim();
  if (!raw) return [];

  const blocks = raw.split(/\n\s*\n/g).map((b) => b.trim()).filter(Boolean);
  const out: FaqItem[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let q = "";
    let a = "";
    for (const line of lines) {
      if (/^(q|question)\s*:/i.test(line)) {
        q = line.replace(/^(q|question)\s*:\s*/i, "").trim();
        continue;
      }
      if (/^(a|answer)\s*:/i.test(line)) {
        a = line.replace(/^(a|answer)\s*:\s*/i, "").trim();
        continue;
      }
      // If the user omitted prefixes, fall back: first line -> Q, rest -> A
      if (!q) {
        q = line;
      } else if (!a) {
        a = line;
      } else {
        a = `${a} ${line}`.trim();
      }
    }
    if (q.trim() && a.trim()) out.push({ question: q.trim(), answer: a.trim() });
  }

  return out;
}

export function EditableFaqsBlock({
  isDark,
  title,
  value,
  baseline,
  isEdited,
  extraActions,
  onSave,
  onResetToGenerated,
}: {
  isDark: boolean;
  title: string;
  value: FaqItem[];
  baseline?: FaqItem[];
  isEdited: boolean;
  extraActions?: React.ReactNode;
  onSave: (next: FaqItem[]) => void;
  onResetToGenerated?: () => void;
}) {
  const textValue = useMemo(() => faqsToText(value), [value]);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(textValue);
  const canReset = typeof onResetToGenerated === "function" && Array.isArray(baseline);

  return (
    <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className={`text-sm font-semibold truncate ${isDark ? "text-slate-100" : "text-gray-900"}`}>{title}</h4>
          {isEdited ? <EditedBadge isDark={isDark} /> : null}
        </div>
        <div className="flex items-center gap-2">
          {extraActions ? <div className="flex items-center gap-2">{extraActions}</div> : null}
          {canReset ? (
            <button
              type="button"
              onClick={() => {
                onResetToGenerated?.();
                setIsEditing(false);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${buttonClasses(isDark, "muted")}`}
            >
              Reset
            </button>
          ) : null}
          {!isEditing ? (
            <button
              type="button"
              onClick={() => {
                setDraft(textValue);
                setIsEditing(true);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${buttonClasses(isDark)}`}
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  onSave(parseFaqsFromText(draft));
                  setIsEditing(false);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${buttonClasses(isDark)}`}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(textValue);
                  setIsEditing(false);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${buttonClasses(isDark, "muted")}`}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {!isEditing ? (
        <div className="space-y-3">
          {value.length > 0 ? (
            value.map((faq, idx) => (
              <div
                key={idx}
                className={`pb-3 ${
                  idx < value.length - 1 ? "border-b " + (isDark ? "border-slate-700" : "border-slate-200") : ""
                }`}
              >
                <p className={`font-medium mb-1 text-sm ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                  {faq.question}
                </p>
                <p className={`text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>{faq.answer}</p>
              </div>
            ))
          ) : (
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>No FAQs</p>
          )}
        </div>
      ) : (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          placeholder={"Q: Question...\nA: Answer...\n\nQ: ...\nA: ..."}
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            isDark
              ? "bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500"
              : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"
          }`}
        />
      )}
    </div>
  );
}


