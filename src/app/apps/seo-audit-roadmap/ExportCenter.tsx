"use client";

import { useMemo, useRef, useState } from "react";
import type { SEOAuditRoadmapRequest, SEOAuditRoadmapResponse } from "./types";
import { SEO_AUDIT_SECTION_DEFS, type Tier5SectionId } from "./sections";

type ExportMode = "full" | "roadmap" | "section";
type ExportFormat = "text" | "markdown" | "html";

function safeFilename(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function formatStatus(status: string): "Good" | "Needs Work" | "Missing" {
  if (status === "pass") return "Good";
  if (status === "needs-improvement") return "Needs Work";
  return "Missing";
}

function formatSourceLine(sourceInput: SEOAuditRoadmapRequest | null) {
  if (!sourceInput) return null;
  const bits: string[] = [];
  if (sourceInput.primaryService) bits.push(sourceInput.primaryService);
  if (sourceInput.city || sourceInput.state) bits.push(`${sourceInput.city || ""}${sourceInput.city && sourceInput.state ? ", " : ""}${sourceInput.state || ""}`.trim());
  if (sourceInput.businessType) bits.push(sourceInput.businessType);
  return bits.length ? bits.join(" • ") : null;
}

function buildHeaderLines(args: {
  audit: SEOAuditRoadmapResponse;
  businessName?: string | null;
  sourceInput?: SEOAuditRoadmapRequest | null;
}) {
  const { audit, businessName, sourceInput } = args;
  const lines: string[] = [];
  lines.push("SEO Audit & Roadmap");
  if (businessName?.trim()) lines.push(`Business: ${businessName.trim()}`);
  const sourceLine = formatSourceLine(sourceInput ?? null);
  if (sourceLine) lines.push(`Context: ${sourceLine}`);
  if (sourceInput?.pageUrl) lines.push(`Audited URL: ${sourceInput.pageUrl}`);
  lines.push(`Generated at: ${audit.meta.auditedAtISO}`);
  lines.push(`Version ID: ${audit.meta.requestId}`);
  return lines;
}

function buildFullText(args: {
  audit: SEOAuditRoadmapResponse;
  businessName?: string | null;
  sourceInput?: SEOAuditRoadmapRequest | null;
}) {
  const { audit, businessName, sourceInput } = args;
  const lines: string[] = [];
  lines.push(...buildHeaderLines({ audit, businessName, sourceInput }));
  lines.push("");
  lines.push(`Score: ${audit.score}/100 (${audit.band})`);
  lines.push(`Summary: ${audit.summary}`);
  lines.push("");

  lines.push("Findings");
  lines.push("--------");
  for (const section of SEO_AUDIT_SECTION_DEFS) {
    lines.push(`${section.title}`);
    const categories = section.categoryKeys
      .map((k) => audit.categoryResults.find((c) => c.key === k))
      .filter(Boolean);
    if (!categories.length) {
      lines.push(`- ${section.emptyState?.summary ?? "No checks available"}`);
      lines.push("");
      continue;
    }
    for (const c of categories) {
      lines.push(`- ${c!.label} (${c!.pointsEarned}/${c!.pointsMax}) — ${formatStatus(c!.status)}`);
      lines.push(`  - ${c!.shortExplanation}`);
      lines.push(`  - Fix: ${c!.fixRecommendation}`);
    }
    lines.push("");
  }

  lines.push("Roadmap (ordered)");
  lines.push("-----------------");
  if (!audit.roadmap.length) {
    lines.push("No roadmap items.");
    return lines.join("\n");
  }
  for (const item of audit.roadmap) {
    lines.push(`[${item.priority}] ${item.title} (+${item.pointsAvailable} pts, ${item.estimatedEffort} effort)`);
    lines.push(`- Issue: ${item.whatIsWrong}`);
    lines.push(`- Why it matters: ${item.whyItMatters}`);
    if (item.nextSteps?.length) {
      lines.push(`- Next steps:`);
      for (const step of item.nextSteps) lines.push(`  - ${step}`);
    }
    if (item.relatedApp) lines.push(`- Related app: ${item.relatedApp.name} (${item.relatedApp.href})`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

function buildRoadmapOnlyText(args: {
  audit: SEOAuditRoadmapResponse;
  businessName?: string | null;
  sourceInput?: SEOAuditRoadmapRequest | null;
}) {
  const { audit, businessName, sourceInput } = args;
  const lines: string[] = [];
  lines.push(...buildHeaderLines({ audit, businessName, sourceInput }));
  lines.push("");
  lines.push("Roadmap (ordered)");
  lines.push("-----------------");
  if (!audit.roadmap.length) {
    lines.push("No roadmap items.");
    return lines.join("\n") + "\n";
  }
  for (const item of audit.roadmap) {
    lines.push(`[${item.priority}] ${item.title}`);
    if (item.nextSteps?.length) {
      for (const step of item.nextSteps) lines.push(`- ${step}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

function buildSectionText(args: {
  audit: SEOAuditRoadmapResponse;
  sectionId: Tier5SectionId;
  businessName?: string | null;
  sourceInput?: SEOAuditRoadmapRequest | null;
}) {
  const { audit, sectionId, businessName, sourceInput } = args;
  const section = SEO_AUDIT_SECTION_DEFS.find((s) => s.id === sectionId)!;
  const categories = section.categoryKeys
    .map((k) => audit.categoryResults.find((c) => c.key === k))
    .filter(Boolean);

  const lines: string[] = [];
  lines.push(...buildHeaderLines({ audit, businessName, sourceInput }));
  lines.push("");
  lines.push(section.title);
  lines.push("-".repeat(section.title.length));
  if (!categories.length) {
    lines.push(section.emptyState?.detail ?? "No checks available for this section yet.");
    return lines.join("\n") + "\n";
  }
  for (const c of categories) {
    lines.push(`${c!.label} (${c!.pointsEarned}/${c!.pointsMax}) — ${formatStatus(c!.status)}`);
    lines.push(`- ${c!.shortExplanation}`);
    lines.push(`- Fix: ${c!.fixRecommendation}`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

function buildFullMarkdown(args: {
  audit: SEOAuditRoadmapResponse;
  businessName?: string | null;
  sourceInput?: SEOAuditRoadmapRequest | null;
}) {
  const { audit, businessName, sourceInput } = args;
  const lines: string[] = [];
  lines.push("# SEO Audit & Roadmap");
  if (businessName?.trim()) lines.push(`**Business:** ${businessName.trim()}`);
  const sourceLine = formatSourceLine(sourceInput ?? null);
  if (sourceLine) lines.push(`**Context:** ${sourceLine}`);
  if (sourceInput?.pageUrl) lines.push(`**Audited URL:** ${sourceInput.pageUrl}`);
  lines.push(`**Generated at:** ${audit.meta.auditedAtISO}`);
  lines.push(`**Version ID:** ${audit.meta.requestId}`);
  lines.push("");
  lines.push(`## Overall`);
  lines.push(`- **Score:** ${audit.score}/100 (${audit.band})`);
  lines.push(`- **Summary:** ${audit.summary}`);
  lines.push("");

  lines.push("## Findings");
  for (const section of SEO_AUDIT_SECTION_DEFS) {
    lines.push(`### ${section.title}`);
    const categories = section.categoryKeys
      .map((k) => audit.categoryResults.find((c) => c.key === k))
      .filter(Boolean);
    if (!categories.length) {
      lines.push(`- ${section.emptyState?.summary ?? "No checks available"}`);
      lines.push("");
      continue;
    }
    for (const c of categories) {
      lines.push(`- **${c!.label}** (${c!.pointsEarned}/${c!.pointsMax}) — **${formatStatus(c!.status)}**`);
      lines.push(`  - ${c!.shortExplanation}`);
      lines.push(`  - **Fix:** ${c!.fixRecommendation}`);
    }
    lines.push("");
  }

  lines.push("## Roadmap (ordered)");
  if (!audit.roadmap.length) {
    lines.push("_No roadmap items._");
    return lines.join("\n") + "\n";
  }
  for (const item of audit.roadmap) {
    lines.push(`- **[${item.priority}] ${item.title}** (+${item.pointsAvailable} pts, ${item.estimatedEffort} effort)`);
    lines.push(`  - **Issue:** ${item.whatIsWrong}`);
    lines.push(`  - **Why it matters:** ${item.whyItMatters}`);
    if (item.nextSteps?.length) {
      lines.push(`  - **Next steps:**`);
      for (const step of item.nextSteps) lines.push(`    - ${step}`);
    }
    if (item.relatedApp) lines.push(`  - **Related app:** ${item.relatedApp.name} (${item.relatedApp.href})`);
  }
  return lines.join("\n") + "\n";
}

function buildRoadmapOnlyMarkdown(args: {
  audit: SEOAuditRoadmapResponse;
  businessName?: string | null;
  sourceInput?: SEOAuditRoadmapRequest | null;
}) {
  const { audit, businessName, sourceInput } = args;
  const lines: string[] = [];
  lines.push("# SEO Roadmap (ordered)");
  if (businessName?.trim()) lines.push(`**Business:** ${businessName.trim()}`);
  const sourceLine = formatSourceLine(sourceInput ?? null);
  if (sourceLine) lines.push(`**Context:** ${sourceLine}`);
  lines.push(`**Generated at:** ${audit.meta.auditedAtISO}`);
  lines.push(`**Version ID:** ${audit.meta.requestId}`);
  lines.push("");
  if (!audit.roadmap.length) {
    lines.push("_No roadmap items._");
    return lines.join("\n") + "\n";
  }
  for (const item of audit.roadmap) {
    lines.push(`- **[${item.priority}] ${item.title}**`);
    if (item.nextSteps?.length) {
      for (const step of item.nextSteps) lines.push(`  - ${step}`);
    }
  }
  return lines.join("\n") + "\n";
}

function buildSectionMarkdown(args: {
  audit: SEOAuditRoadmapResponse;
  sectionId: Tier5SectionId;
  businessName?: string | null;
  sourceInput?: SEOAuditRoadmapRequest | null;
}) {
  const { audit, sectionId, businessName, sourceInput } = args;
  const section = SEO_AUDIT_SECTION_DEFS.find((s) => s.id === sectionId)!;
  const categories = section.categoryKeys
    .map((k) => audit.categoryResults.find((c) => c.key === k))
    .filter(Boolean);

  const lines: string[] = [];
  lines.push(`# ${section.title}`);
  if (businessName?.trim()) lines.push(`**Business:** ${businessName.trim()}`);
  const sourceLine = formatSourceLine(sourceInput ?? null);
  if (sourceLine) lines.push(`**Context:** ${sourceLine}`);
  lines.push(`**Generated at:** ${audit.meta.auditedAtISO}`);
  lines.push(`**Version ID:** ${audit.meta.requestId}`);
  lines.push("");
  if (!categories.length) {
    lines.push(section.emptyState?.detail ?? "No checks available for this section yet.");
    return lines.join("\n") + "\n";
  }
  for (const c of categories) {
    lines.push(`- **${c!.label}** (${c!.pointsEarned}/${c!.pointsMax}) — **${formatStatus(c!.status)}**`);
    lines.push(`  - ${c!.shortExplanation}`);
    lines.push(`  - **Fix:** ${c!.fixRecommendation}`);
  }
  return lines.join("\n") + "\n";
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtmlDocument(args: {
  title: string;
  audit: SEOAuditRoadmapResponse;
  businessName?: string | null;
  sourceInput?: SEOAuditRoadmapRequest | null;
  bodyInnerHtml: string;
}) {
  const { title, audit, businessName, sourceInput, bodyInnerHtml } = args;
  const metaLines = buildHeaderLines({ audit, businessName, sourceInput })
    .map((l) => `<div class="meta-row">${escapeHtml(l)}</div>`)
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0f172a; margin: 24px; }
      h1,h2,h3 { margin: 0 0 10px 0; }
      .meta { border: 1px solid #e2e8f0; background: #f8fafc; padding: 12px; border-radius: 10px; margin: 0 0 16px 0; }
      .meta-row { font-size: 12px; color: #334155; line-height: 1.4; }
      .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin: 14px 0; }
      .muted { color: #475569; }
      .k { font-weight: 600; }
      ul { margin: 8px 0 0 18px; }
      .hr { height: 1px; background: #e2e8f0; margin: 16px 0; }
      .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; border: 1px solid #e2e8f0; background: #fff; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">${metaLines}</div>
    ${bodyInnerHtml}
    <div class="hr"></div>
    <div class="muted" style="font-size:12px;">Advisory only. Nothing is changed automatically. Draft-only outputs. You choose what to apply.</div>
  </body>
</html>`;
}

function buildFullHtml(args: {
  audit: SEOAuditRoadmapResponse;
  businessName?: string | null;
  sourceInput?: SEOAuditRoadmapRequest | null;
}) {
  const { audit, businessName, sourceInput } = args;

  const findingsHtml = SEO_AUDIT_SECTION_DEFS.map((section) => {
    const categories = section.categoryKeys
      .map((k) => audit.categoryResults.find((c) => c.key === k))
      .filter(Boolean);
    const inner = categories.length
      ? categories
          .map((c) => {
            const status = formatStatus(c!.status);
            return `<div class="card">
  <div><span class="k">${escapeHtml(c!.label)}</span> <span class="muted">(${c!.pointsEarned}/${c!.pointsMax})</span> <span class="pill">${escapeHtml(status)}</span></div>
  <div class="muted" style="margin-top:8px;">${escapeHtml(c!.shortExplanation)}</div>
  <div class="muted" style="margin-top:6px;"><span class="k">Fix:</span> ${escapeHtml(c!.fixRecommendation)}</div>
</div>`;
          })
          .join("")
      : `<div class="card"><div class="muted">${escapeHtml(section.emptyState?.detail ?? section.emptyState?.summary ?? "No checks available")}</div></div>`;

    return `<h2>${escapeHtml(section.title)}</h2>${inner}`;
  }).join(`<div class="hr"></div>`);

  const roadmapInner =
    audit.roadmap.length === 0
      ? `<div class="card"><div class="muted">No roadmap items.</div></div>`
      : audit.roadmap
          .map((item) => {
            const steps = item.nextSteps?.length
              ? `<ul>${item.nextSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
              : "";
            return `<div class="card">
  <div><span class="k">[${escapeHtml(item.priority)}]</span> ${escapeHtml(item.title)} <span class="muted">(+${item.pointsAvailable} pts, ${escapeHtml(item.estimatedEffort)} effort)</span></div>
  <div class="muted" style="margin-top:8px;"><span class="k">Issue:</span> ${escapeHtml(item.whatIsWrong)}</div>
  <div class="muted" style="margin-top:6px;"><span class="k">Why it matters:</span> ${escapeHtml(item.whyItMatters)}</div>
  ${steps}
</div>`;
          })
          .join("");

  const overall = `<div class="card">
  <div><span class="k">Score:</span> ${audit.score}/100 (${escapeHtml(audit.band)})</div>
  <div class="muted" style="margin-top:6px;">${escapeHtml(audit.summary)}</div>
</div>`;

  const body = `${overall}<div class="hr"></div>${findingsHtml}<div class="hr"></div><h2>Roadmap (ordered)</h2>${roadmapInner}`;

  return buildHtmlDocument({
    title: "SEO Audit & Roadmap",
    audit,
    businessName,
    sourceInput,
    bodyInnerHtml: body,
  });
}

function buildRoadmapOnlyHtml(args: {
  audit: SEOAuditRoadmapResponse;
  businessName?: string | null;
  sourceInput?: SEOAuditRoadmapRequest | null;
}) {
  const { audit, businessName, sourceInput } = args;
  const roadmapInner =
    audit.roadmap.length === 0
      ? `<div class="card"><div class="muted">No roadmap items.</div></div>`
      : audit.roadmap
          .map((item) => {
            const steps = item.nextSteps?.length
              ? `<ul>${item.nextSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
              : "";
            return `<div class="card">
  <div><span class="k">[${escapeHtml(item.priority)}]</span> ${escapeHtml(item.title)}</div>
  ${steps}
</div>`;
          })
          .join("");

  return buildHtmlDocument({
    title: "SEO Roadmap (ordered)",
    audit,
    businessName,
    sourceInput,
    bodyInnerHtml: `<h2>Roadmap</h2>${roadmapInner}`,
  });
}

function buildSectionHtml(args: {
  audit: SEOAuditRoadmapResponse;
  sectionId: Tier5SectionId;
  businessName?: string | null;
  sourceInput?: SEOAuditRoadmapRequest | null;
}) {
  const { audit, sectionId, businessName, sourceInput } = args;
  const section = SEO_AUDIT_SECTION_DEFS.find((s) => s.id === sectionId)!;
  const categories = section.categoryKeys
    .map((k) => audit.categoryResults.find((c) => c.key === k))
    .filter(Boolean);

  const inner = categories.length
    ? categories
        .map((c) => {
          const status = formatStatus(c!.status);
          return `<div class="card">
  <div><span class="k">${escapeHtml(c!.label)}</span> <span class="muted">(${c!.pointsEarned}/${c!.pointsMax})</span> <span class="pill">${escapeHtml(status)}</span></div>
  <div class="muted" style="margin-top:8px;">${escapeHtml(c!.shortExplanation)}</div>
  <div class="muted" style="margin-top:6px;"><span class="k">Fix:</span> ${escapeHtml(c!.fixRecommendation)}</div>
</div>`;
        })
        .join("")
    : `<div class="card"><div class="muted">${escapeHtml(section.emptyState?.detail ?? section.emptyState?.summary ?? "No checks available")}</div></div>`;

  return buildHtmlDocument({
    title: section.title,
    audit,
    businessName,
    sourceInput,
    bodyInnerHtml: `<h2>${escapeHtml(section.title)}</h2>${inner}`,
  });
}

export default function SEOAuditExportCenter({
  isDark,
  audit,
  sourceInput,
  businessName,
}: {
  isDark: boolean;
  audit: SEOAuditRoadmapResponse | null;
  sourceInput: SEOAuditRoadmapRequest | null;
  businessName?: string | null;
}) {
  const [mode, setMode] = useState<ExportMode>("full");
  const [format, setFormat] = useState<ExportFormat>("text");
  const [sectionId, setSectionId] = useState<Tier5SectionId>("technical");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const canExport = !!audit;
  const exportBlockedReason = "Run an audit first to enable export.";

  const effectiveFormat: ExportFormat = useMemo(() => {
    if (mode === "roadmap" && format === "html") return "markdown";
    return format;
  }, [mode, format]);

  const exportPackage = useMemo(() => {
    if (!audit) return { filename: "", mime: "text/plain", content: "" };

    const base = businessName?.trim() ? safeFilename(businessName) : "seo-audit";
    const version = safeFilename(audit.meta.requestId);

    const titleSuffix =
      mode === "full"
        ? "full-report"
        : mode === "roadmap"
          ? "roadmap"
          : `section-${sectionId}`;

    const name = `${base}-${titleSuffix}-${version}`;

    if (mode === "full" && effectiveFormat === "text") {
      return { filename: `${name}.txt`, mime: "text/plain;charset=utf-8", content: buildFullText({ audit, businessName, sourceInput }) };
    }
    if (mode === "full" && effectiveFormat === "markdown") {
      return { filename: `${name}.md`, mime: "text/markdown;charset=utf-8", content: buildFullMarkdown({ audit, businessName, sourceInput }) };
    }
    if (mode === "full" && effectiveFormat === "html") {
      return { filename: `${name}.html`, mime: "text/html;charset=utf-8", content: buildFullHtml({ audit, businessName, sourceInput }) };
    }

    if (mode === "roadmap" && effectiveFormat === "text") {
      return { filename: `${name}.txt`, mime: "text/plain;charset=utf-8", content: buildRoadmapOnlyText({ audit, businessName, sourceInput }) };
    }
    if (mode === "roadmap" && effectiveFormat === "markdown") {
      return { filename: `${name}.md`, mime: "text/markdown;charset=utf-8", content: buildRoadmapOnlyMarkdown({ audit, businessName, sourceInput }) };
    }

    if (mode === "section" && effectiveFormat === "text") {
      return { filename: `${name}.txt`, mime: "text/plain;charset=utf-8", content: buildSectionText({ audit, sectionId, businessName, sourceInput }) };
    }
    if (mode === "section" && effectiveFormat === "markdown") {
      return { filename: `${name}.md`, mime: "text/markdown;charset=utf-8", content: buildSectionMarkdown({ audit, sectionId, businessName, sourceInput }) };
    }
    if (mode === "section" && effectiveFormat === "html") {
      return { filename: `${name}.html`, mime: "text/html;charset=utf-8", content: buildSectionHtml({ audit, sectionId, businessName, sourceInput }) };
    }

    // Fallback
    return { filename: `${name}.txt`, mime: "text/plain;charset=utf-8", content: buildFullText({ audit, businessName, sourceInput }) };
  }, [audit, businessName, sourceInput, mode, effectiveFormat, sectionId]);

  const download = () => {
    if (!audit) return;
    if (typeof window === "undefined") return;
    const blob = new Blob([exportPackage.content], { type: exportPackage.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportPackage.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!audit) return;
    setCopyError(null);
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(exportPackage.content);
      setCopiedKey("export");
      if (copyTimerRef.current && typeof window !== "undefined") window.clearTimeout(copyTimerRef.current);
      if (typeof window !== "undefined") {
        copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 2000);
      }
    } catch (err) {
      console.error("SEO Audit ExportCenter copy failed:", err);
      setCopyError("Copy failed. Your browser may be blocking clipboard access.");
      setCopiedKey(null);
    }
  };

  const titleText = isDark ? "text-white" : "text-slate-900";
  const mutedText = isDark ? "text-slate-300" : "text-slate-600";

  const panelClass = `rounded-xl border p-4 ${
    isDark ? "border-slate-700 bg-slate-800/40" : "border-slate-200 bg-white"
  }`;

  const buttonPrimary = `text-sm px-4 py-2 rounded-lg transition-colors ${
    isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
  }`;

  const buttonDisabled = `text-sm px-4 py-2 rounded-lg ${
    isDark ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-slate-100 text-slate-400 cursor-not-allowed"
  }`;

  const DisabledWrapper = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <span title={title} className="inline-flex">
      {children}
    </span>
  );

  return (
    <section className="mt-8" id="export-center">
      <div className="flex items-center justify-between gap-3">
        <h2 className={`text-lg font-semibold ${titleText}`}>Export Center</h2>
        <div className={`text-xs ${mutedText}`}>Exports are generated from the active audit snapshot.</div>
      </div>

      <div className={`${panelClass} mt-3`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={`block text-xs font-medium mb-1 ${mutedText}`}>Export</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ExportMode)}
              className={`w-full text-sm rounded-lg border px-3 py-2 ${
                isDark ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
              }`}
            >
              <option value="full">Full report</option>
              <option value="roadmap">Roadmap only</option>
              <option value="section">One section (category-specific)</option>
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${mutedText}`}>Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              className={`w-full text-sm rounded-lg border px-3 py-2 ${
                isDark ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
              }`}
            >
              <option value="text">Plain text</option>
              <option value="markdown">Markdown</option>
              <option value="html">PDF-ready HTML</option>
            </select>
            {mode === "roadmap" && format === "html" ? (
              <p className={`mt-1 text-xs ${mutedText}`}>
                Roadmap-only exports support Plain/Markdown. (HTML disabled)
              </p>
            ) : null}
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${mutedText}`}>Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value as Tier5SectionId)}
              disabled={mode !== "section"}
              className={`w-full text-sm rounded-lg border px-3 py-2 ${
                mode !== "section"
                  ? isDark
                    ? "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                  : isDark
                    ? "bg-slate-900 border-slate-700 text-slate-200"
                    : "bg-white border-slate-300 text-slate-800"
              }`}
              title={mode !== "section" ? "Choose 'One section' to enable" : undefined}
            >
              {SEO_AUDIT_SECTION_DEFS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 justify-between">
          <div className={`text-xs ${mutedText}`}>
            {audit ? (
              <>
                Version: <span className="font-medium">{audit.meta.requestId}</span> · Generated:{" "}
                <span className="font-medium">{audit.meta.auditedAtISO}</span>
              </>
            ) : (
              "No completed audit yet."
            )}
          </div>
          <div className="flex gap-2">
            {!canExport ? (
              <DisabledWrapper title={exportBlockedReason}>
                <button className={buttonDisabled} disabled>
                  Copy
                </button>
              </DisabledWrapper>
            ) : (
              <button className={buttonPrimary} onClick={copy} type="button">
                {copiedKey === "export" ? "Copied!" : "Copy"}
              </button>
            )}

            {!canExport ? (
              <DisabledWrapper title={exportBlockedReason}>
                <button className={buttonDisabled} disabled>
                  Download
                </button>
              </DisabledWrapper>
            ) : (
              <button className={buttonPrimary} onClick={download} type="button">
                Download
              </button>
            )}
          </div>
        </div>

        {copyError ? (
          <div className={`mt-3 text-xs ${isDark ? "text-red-300" : "text-red-600"}`}>{copyError}</div>
        ) : null}

        <div className="mt-4">
          <label className={`block text-xs font-medium mb-1 ${mutedText}`}>Preview (read-only)</label>
          <textarea
            readOnly
            value={canExport ? exportPackage.content : ""}
            rows={10}
            className={`w-full text-xs rounded-lg border px-3 py-2 font-mono ${
              isDark ? "bg-slate-950 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-300 text-slate-800"
            }`}
            placeholder={canExport ? "" : "Run an audit to enable export previews."}
          />
        </div>
      </div>
    </section>
  );
}


