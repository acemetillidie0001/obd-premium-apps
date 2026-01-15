"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type ExportIssue, getExportPackages, getSectionExports } from "./exportCenter";
import { getSecondaryButtonClasses, getSubtleButtonSmallClasses } from "@/lib/obd-framework/layout-helpers";

export type ExportCenterProps = {
  activeJson: string;
  issues: ExportIssue[];
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function parseRgb(input: string): { r: number; g: number; b: number } | null {
  // Handles: rgb(r, g, b) and rgba(r, g, b, a)
  const m = input.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function isDarkFromBackgroundColor(backgroundColor: string): boolean {
  const rgb = parseRgb(backgroundColor);
  if (!rgb) return false;
  // Relative luminance approximation in sRGB space (good enough for bg detection)
  const r = clamp01(rgb.r / 255);
  const g = clamp01(rgb.g / 255);
  const b = clamp01(rgb.b / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.45;
}

export default function ExportCenter({ activeJson, issues }: ExportCenterProps) {
  const [isDark, setIsDark] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const blockers = useMemo(() => issues.filter((i) => i.level === "blocker"), [issues]);
  const warnings = useMemo(() => issues.filter((i) => i.level === "warning"), [issues]);
  const hasBlockers = blockers.length > 0;

  // Theme detection without adding an isDark prop: observe page container background changes.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const el = document.getElementById("main-content");
    if (!el) return;

    const update = () => {
      try {
        const bg = window.getComputedStyle(el).backgroundColor;
        setIsDark(isDarkFromBackgroundColor(bg));
      } catch {
        // ignore
      }
    };

    update();

    const observer = new MutationObserver(() => update());
    observer.observe(el, { attributes: true, attributeFilter: ["class", "style"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  const packages = useMemo(() => {
    if (hasBlockers) {
      return {
        jsonld: null,
        pretty: null,
        html: null,
      } as const;
    }

    const all = getExportPackages(activeJson);
    const jsonld = all.find((p) => p.format === "jsonld") ?? null;
    const pretty = all.find((p) => p.format === "json-pretty") ?? null;
    const html = all.find((p) => p.format === "html-script") ?? null;

    return {
      jsonld,
      pretty,
      html,
    } as const;
  }, [activeJson, hasBlockers]);

  const sectionExports = useMemo(() => {
    if (hasBlockers) return [];
    return getSectionExports(activeJson);
  }, [activeJson, hasBlockers]);

  const download = (filename: string, content: string, mime: string) => {
    if (typeof window === "undefined") return;
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copy = async (key: string, content: string) => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(content);
      setCopiedKey(key);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error("ExportCenter copy failed:", err);
      setCopyError("Copy failed. Your browser may be blocking clipboard access.");
      setCopiedKey(null);
    }
  };

  const statusLabel = hasBlockers
    ? "Export blocked"
    : warnings.length > 0
    ? "Export ready (with warnings)"
    : "Export ready";

  const statusClasses = hasBlockers
    ? isDark
      ? "bg-red-900/30 border-red-700 text-red-200"
      : "bg-red-50 border-red-200 text-red-800"
    : warnings.length > 0
    ? isDark
      ? "bg-amber-900/30 border-amber-700 text-amber-200"
      : "bg-amber-50 border-amber-200 text-amber-800"
    : isDark
    ? "bg-emerald-900/20 border-emerald-700 text-emerald-200"
    : "bg-emerald-50 border-emerald-200 text-emerald-800";

  const titleText = isDark ? "text-white" : "text-slate-900";
  const mutedText = isDark ? "text-slate-300" : "text-slate-600";

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className={`text-lg font-semibold ${titleText}`}>Export Center</h2>
        <div className={`text-xs ${mutedText}`}>Exports are generated from the active JSON-LD.</div>
      </div>

      <div className={`mt-3 rounded-xl border p-3 text-sm ${statusClasses}`} role="status" aria-live="polite">
        <div className="font-semibold">{statusLabel}</div>

        {blockers.length > 0 && (
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {blockers.map((i) => (
              <li key={`${i.level}:${i.code}`}>{i.message}</li>
            ))}
          </ul>
        )}

        {blockers.length === 0 && warnings.length > 0 && (
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {warnings.map((i) => (
              <li key={`${i.level}:${i.code}`}>{i.message}</li>
            ))}
          </ul>
        )}
      </div>

      {copyError && (
        <div
          className={`mt-3 rounded-xl border p-3 text-sm ${
            isDark ? "bg-red-900/20 border-red-700 text-red-200" : "bg-red-50 border-red-200 text-red-800"
          }`}
          role="alert"
        >
          {copyError}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3">
        {/* JSON-LD (raw) */}
        <div
          className={`rounded-xl border p-4 ${
            isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${titleText}`}>JSON-LD (raw)</div>
              <div className={`text-xs mt-1 ${mutedText}`}>File: {packages.jsonld?.filename ?? "schema.jsonld"}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                disabled={hasBlockers || !packages.jsonld}
                className={getSubtleButtonSmallClasses(isDark)}
                onClick={() => packages.jsonld && copy("format:jsonld", packages.jsonld.content)}
              >
                {copiedKey === "format:jsonld" ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                disabled={hasBlockers || !packages.jsonld}
                className={getSecondaryButtonClasses(isDark)}
                onClick={() =>
                  packages.jsonld && download(packages.jsonld.filename, packages.jsonld.content, packages.jsonld.mime)
                }
              >
                Download
              </button>
            </div>
          </div>
        </div>

        {/* Pretty JSON */}
        <div
          className={`rounded-xl border p-4 ${
            isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${titleText}`}>Pretty JSON</div>
              <div className={`text-xs mt-1 ${mutedText}`}>File: {packages.pretty?.filename ?? "schema.json"}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                disabled={hasBlockers || !packages.pretty}
                className={getSubtleButtonSmallClasses(isDark)}
                onClick={() => packages.pretty && copy("format:json-pretty", packages.pretty.content)}
              >
                {copiedKey === "format:json-pretty" ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                disabled={hasBlockers || !packages.pretty}
                className={getSecondaryButtonClasses(isDark)}
                onClick={() =>
                  packages.pretty && download(packages.pretty.filename, packages.pretty.content, packages.pretty.mime)
                }
              >
                Download
              </button>
            </div>
          </div>
        </div>

        {/* HTML script tag */}
        <div
          className={`rounded-xl border p-4 ${
            isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${titleText}`}>HTML script tag</div>
              <div className={`text-xs mt-1 ${mutedText}`}>File: {packages.html?.filename ?? "schema.html"}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                disabled={hasBlockers || !packages.html}
                className={getSubtleButtonSmallClasses(isDark)}
                onClick={() => packages.html && copy("format:html-script", packages.html.content)}
              >
                {copiedKey === "format:html-script" ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                disabled={hasBlockers || !packages.html}
                className={getSecondaryButtonClasses(isDark)}
                onClick={() => packages.html && download(packages.html.filename, packages.html.content, packages.html.mime)}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      </div>

      {sectionExports.length > 0 && (
        <div className="mt-6">
          <div className={`text-sm font-semibold ${titleText}`}>Section exports</div>
          <div className={`text-xs mt-1 ${mutedText}`}>
            Optional exports for identifiable nodes already present in the bundle.
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3">
            {sectionExports.map((pkg) => (
              <div
                key={`${pkg.format}:${pkg.filename}`}
                className={`rounded-xl border p-4 ${
                  isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold ${titleText}`}>{pkg.label}</div>
                    <div className={`text-xs mt-1 ${mutedText}`}>File: {pkg.filename}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      disabled={hasBlockers}
                      className={getSubtleButtonSmallClasses(isDark)}
                      onClick={() => copy(`section:${pkg.filename}`, pkg.content)}
                    >
                      {copiedKey === `section:${pkg.filename}` ? "Copied!" : "Copy"}
                    </button>
                    <button
                      type="button"
                      disabled={hasBlockers}
                      className={getSecondaryButtonClasses(isDark)}
                      onClick={() => download(pkg.filename, pkg.content, pkg.mime)}
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}


