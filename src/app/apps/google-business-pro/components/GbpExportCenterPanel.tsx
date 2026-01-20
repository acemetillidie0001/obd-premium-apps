"use client";

import { useMemo, useState } from "react";
import type { GoogleBusinessDraft } from "../draft";
import { getActiveGbpDraft } from "../draft";
import type { GoogleBusinessWizardResult } from "../types";

function handleDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeName(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

function normalize(s: string | undefined | null): string {
  return (s ?? "").trim();
}

function buildPlainTextPack(content: GoogleBusinessWizardResult): string {
  const parts: string[] = [];

  parts.push("GOOGLE BUSINESS PROFILE (GBP) EXPORT");
  parts.push("");

  parts.push("BUSINESS DESCRIPTION");
  parts.push("-".repeat(40));
  if (normalize(content.shortDescription)) {
    parts.push("Short Description:");
    parts.push(content.shortDescription.trim());
    parts.push("");
  }
  parts.push("Business Description:");
  parts.push(content.longDescription.trim());
  parts.push("");

  parts.push("SERVICES");
  parts.push("-".repeat(40));
  parts.push(content.servicesSection.trim());
  parts.push("");

  parts.push("ABOUT");
  parts.push("-".repeat(40));
  parts.push(content.aboutSection.trim());
  parts.push("");

  if (normalize(content.serviceAreaSection)) {
    parts.push("SERVICE AREA");
    parts.push("-".repeat(40));
    parts.push(content.serviceAreaSection!.trim());
    parts.push("");
  }

  if (normalize(content.openingHoursBlurb)) {
    parts.push("OPENING HOURS");
    parts.push("-".repeat(40));
    parts.push(content.openingHoursBlurb!.trim());
    parts.push("");
  }

  parts.push("FAQS (Q/A)");
  parts.push("-".repeat(40));
  if (content.faqSuggestions.length === 0) {
    parts.push("(none)");
  } else {
    content.faqSuggestions.forEach((faq, i) => {
      parts.push(`Q${i + 1}: ${faq.question}`.trim());
      parts.push(`A${i + 1}: ${faq.answer}`.trim());
      parts.push("");
    });
  }
  parts.push("");

  parts.push("POSTS");
  parts.push("-".repeat(40));
  if (content.postIdeas.length === 0) {
    parts.push("(none)");
  } else {
    content.postIdeas.forEach((p, i) => {
      parts.push(`Post ${i + 1}:`);
      parts.push(p.trim());
      parts.push("");
    });
  }

  return parts.join("\n").trim() + "\n";
}

function buildMarkdownPack(content: GoogleBusinessWizardResult): string {
  const parts: string[] = [];

  parts.push("# Google Business Profile (GBP) Export");
  parts.push("");

  parts.push("## Business Description");
  parts.push("");
  if (normalize(content.shortDescription)) {
    parts.push("**Short Description**");
    parts.push("");
    parts.push(content.shortDescription.trim());
    parts.push("");
  }
  parts.push("**Business Description**");
  parts.push("");
  parts.push(content.longDescription.trim());
  parts.push("");

  parts.push("## Services");
  parts.push("");
  parts.push(content.servicesSection.trim());
  parts.push("");

  parts.push("## About");
  parts.push("");
  parts.push(content.aboutSection.trim());
  parts.push("");

  if (normalize(content.serviceAreaSection)) {
    parts.push("## Service Area");
    parts.push("");
    parts.push(content.serviceAreaSection!.trim());
    parts.push("");
  }

  if (normalize(content.openingHoursBlurb)) {
    parts.push("## Opening Hours");
    parts.push("");
    parts.push(content.openingHoursBlurb!.trim());
    parts.push("");
  }

  parts.push("## FAQs");
  parts.push("");
  if (content.faqSuggestions.length === 0) {
    parts.push("_None_");
  } else {
    content.faqSuggestions.forEach((faq) => {
      parts.push(`### ${faq.question}`.trim());
      parts.push("");
      parts.push(faq.answer.trim());
      parts.push("");
    });
  }

  parts.push("## Posts");
  parts.push("");
  if (content.postIdeas.length === 0) {
    parts.push("_None_");
  } else {
    content.postIdeas.forEach((p, i) => {
      parts.push(`### Post ${i + 1}`);
      parts.push("");
      parts.push(p.trim());
      parts.push("");
    });
  }

  return parts.join("\n").trim() + "\n";
}

type Blocker = { id: string; title: string; message: string };
type Warning = { id: string; title: string; message: string };

function charCount(s: string): number {
  return (s || "").length;
}

export default function GbpExportCenterPanel({
  isDark,
  draft,
  businessName,
  onToast,
}: {
  isDark: boolean;
  draft: GoogleBusinessDraft;
  businessName?: string;
  onToast: (message: string) => void;
}) {
  const active = useMemo(() => getActiveGbpDraft(draft), [draft]);
  const content = active?.content ?? null;

  const readiness = useMemo(() => {
    const blockers: Blocker[] = [];
    const warnings: Warning[] = [];

    if (!active) {
      blockers.push({
        id: "no-draft",
        title: "No draft yet",
        message: "Generate Wizard content to enable exports.",
      });
      return { blockers, warnings, hasAnyExport: false, canExportPack: false };
    }

    if (!content) {
      blockers.push({
        id: "no-content",
        title: "No GBP content yet",
        message: "Run the Wizard first (content pack) to enable exports.",
      });
      return { blockers, warnings, hasAnyExport: false, canExportPack: false };
    }

    const longDesc = normalize(content.longDescription);
    const services = normalize(content.servicesSection);
    const about = normalize(content.aboutSection);

    // "Pack" exports require core blocks (descriptions + services + about).
    if (!longDesc) {
      blockers.push({ id: "missing-long", title: "Missing description", message: "Business description is empty." });
    }
    if (!services) {
      blockers.push({ id: "missing-services", title: "Missing services", message: "Services section is empty." });
    }
    if (!about) {
      blockers.push({ id: "missing-about", title: "Missing about", message: "About section is empty." });
    }

    // Soft warnings (never blocking) for optional blocks.
    if (content.faqSuggestions.length === 0) {
      warnings.push({ id: "no-faqs", title: "No FAQs", message: "FAQs are empty (optional, but recommended)." });
    }
    if (content.postIdeas.length === 0) {
      warnings.push({ id: "no-posts", title: "No posts", message: "Posts are empty (optional, but recommended)." });
    }

    const canExportPack = blockers.length === 0;
    return { blockers, warnings, hasAnyExport: true, canExportPack };
  }, [active, content]);

  const exports = useMemo(() => {
    if (!content) return null;
    const plainText = buildPlainTextPack(content);
    const markdown = buildMarkdownPack(content);

    const blocks = {
      businessDescription: normalize(content.longDescription),
      services: normalize(content.servicesSection),
      faqs:
        content.faqSuggestions.length === 0
          ? ""
          : content.faqSuggestions
              .map((f, i) => `Q${i + 1}: ${f.question}\nA${i + 1}: ${f.answer}`.trim())
              .join("\n\n"),
      posts:
        content.postIdeas.length === 0
          ? ""
          : content.postIdeas.map((p, i) => `Post ${i + 1}:\n${p}`.trim()).join("\n\n"),
    };

    return { plainText, markdown, blocks };
  }, [content]);

  // Character awareness (warnings only; not policy enforcement)
  const charWarnings = useMemo(() => {
    if (!content) return [] as string[];
    const warnings: string[] = [];

    // GBP guidance ranges (FYI only)
    const LONG_DESC_GUIDE = 750;
    const POST_GUIDE = 1500;

    const longLen = charCount(content.longDescription);
    if (longLen > LONG_DESC_GUIDE) {
      warnings.push(`Business description is ${longLen} chars (FYI: many GBP descriptions are kept ≤ ${LONG_DESC_GUIDE}).`);
    }

    const postTooLong = content.postIdeas.find((p) => charCount(p) > POST_GUIDE);
    if (postTooLong) {
      warnings.push(`At least one post is over ${POST_GUIDE} chars (FYI: many GBP posts are kept ≤ ${POST_GUIDE}).`);
    }

    return warnings;
  }, [content]);

  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const disabledAll = readiness.blockers.length > 0 || !exports;

  const buttonClasses = (tone: "primary" | "muted" = "primary", isActive = false, isDisabled = false) => {
    const base = "px-4 py-2 text-sm font-medium rounded-lg transition-colors";
    const disabled = isDisabled ? " opacity-50 cursor-not-allowed pointer-events-none" : "";
    if (isActive) {
      return `${base} bg-[#29c4a9] text-white${disabled}`;
    }
    if (tone === "muted") {
      return `${base} border ${isDark ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-100"}${disabled}`;
    }
    return `${base} ${isDark ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white" : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"}${disabled}`;
  };

  const doCopy = async (id: string, label: string, text: string, disabled: boolean) => {
    if (disabled) return;
    await navigator.clipboard.writeText(text);
    setCopied((p) => ({ ...p, [id]: true }));
    onToast(`Copied ${label}`);
    setTimeout(() => setCopied((p) => ({ ...p, [id]: false })), 1200);
  };

  const doDownload = (label: string, content: string, filename: string, mime: string, disabled: boolean) => {
    if (disabled) return;
    handleDownload(content, filename, mime);
    onToast(`Downloaded ${label}`);
  };

  const name = safeName(businessName || "gbp");
  const packDisabled = disabledAll || !readiness.canExportPack;

  // Individual block readiness
  const blockReady = {
    description: Boolean(normalize(content?.longDescription)),
    services: Boolean(normalize(content?.servicesSection)),
    faqs: Boolean((content?.faqSuggestions?.length ?? 0) > 0),
    posts: Boolean((content?.postIdeas?.length ?? 0) > 0),
  };

  const blockDisabledReason = (key: keyof typeof blockReady): string | null => {
    if (disabledAll) return "Generate Wizard content to enable exports.";
    if (!blockReady[key]) {
      if (key === "faqs") return "No FAQs available in the active draft.";
      if (key === "posts") return "No posts available in the active draft.";
      return `Missing ${key} content in the active draft.`;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Readiness */}
      {(readiness.blockers.length > 0 || readiness.warnings.length > 0 || charWarnings.length > 0) && (
        <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/40 border-slate-700" : "bg-white border-slate-200"}`}>
          {readiness.blockers.length > 0 && (
            <div className="mb-3">
              <p className={`text-sm font-semibold ${isDark ? "text-red-200" : "text-red-700"}`}>Blockers</p>
              <ul className={`mt-1 text-sm list-disc list-inside ${isDark ? "text-red-100" : "text-red-700"}`}>
                {readiness.blockers.map((b) => (
                  <li key={b.id}>
                    <span className="font-medium">{b.title}:</span> {b.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {readiness.warnings.length > 0 && (
            <div className="mb-3">
              <p className={`text-sm font-semibold ${isDark ? "text-amber-200" : "text-amber-800"}`}>Warnings</p>
              <ul className={`mt-1 text-sm list-disc list-inside ${isDark ? "text-amber-100" : "text-amber-700"}`}>
                {readiness.warnings.map((w) => (
                  <li key={w.id}>
                    <span className="font-medium">{w.title}:</span> {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {charWarnings.length > 0 && (
            <div>
              <p className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>Character Awareness (FYI)</p>
              <ul className={`mt-1 text-sm list-disc list-inside ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                {charWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Quick Exports */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>Quick Exports (Authoritative)</h4>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => doCopy("plain-pack", "Plain Text pack", exports?.plainText ?? "", packDisabled)}
            className={buttonClasses("primary", Boolean(copied["plain-pack"]), packDisabled)}
            disabled={packDisabled}
            title={packDisabled ? "Fix blockers above to enable this export." : "Copy the full pack as plain text."}
          >
            {copied["plain-pack"] ? "Copied!" : "Copy Plain Text"}
          </button>
          <button
            type="button"
            onClick={() => doCopy("md-pack", "Markdown pack", exports?.markdown ?? "", packDisabled)}
            className={buttonClasses("primary", Boolean(copied["md-pack"]), packDisabled)}
            disabled={packDisabled}
            title={packDisabled ? "Fix blockers above to enable this export." : "Copy the full pack as Markdown."}
          >
            {copied["md-pack"] ? "Copied!" : "Copy Markdown"}
          </button>

          <button
            type="button"
            onClick={() =>
              doDownload("Plain Text", exports?.plainText ?? "", `gbp-${name || "export"}-${Date.now()}.txt`, "text/plain", packDisabled)
            }
            className={buttonClasses("muted", false, packDisabled)}
            disabled={packDisabled}
          >
            Download .txt
          </button>
          <button
            type="button"
            onClick={() =>
              doDownload("Markdown", exports?.markdown ?? "", `gbp-${name || "export"}-${Date.now()}.md`, "text/markdown", packDisabled)
            }
            className={buttonClasses("muted", false, packDisabled)}
            disabled={packDisabled}
          >
            Download .md
          </button>
        </div>
      </div>

      {/* GBP formatted blocks */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>GBP Formatted Blocks</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Business Description */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Business Description</p>
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {content ? `${charCount(content.longDescription)} chars` : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => doCopy("block-desc", "Business Description", exports?.blocks.businessDescription ?? "", Boolean(blockDisabledReason("description")))}
                className={buttonClasses("primary", Boolean(copied["block-desc"]), Boolean(blockDisabledReason("description")))}
                disabled={Boolean(blockDisabledReason("description"))}
                title={blockDisabledReason("description") ?? "Copy the description block."}
              >
                {copied["block-desc"] ? "Copied!" : "Copy"}
              </button>
            </div>
            {blockDisabledReason("description") ? (
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{blockDisabledReason("description")}</p>
            ) : (
              <pre className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                {exports?.blocks.businessDescription || ""}
              </pre>
            )}
          </div>

          {/* Services */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Services</p>
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {content ? `${charCount(content.servicesSection)} chars` : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => doCopy("block-services", "Services", exports?.blocks.services ?? "", Boolean(blockDisabledReason("services")))}
                className={buttonClasses("primary", Boolean(copied["block-services"]), Boolean(blockDisabledReason("services")))}
                disabled={Boolean(blockDisabledReason("services"))}
                title={blockDisabledReason("services") ?? "Copy the services block."}
              >
                {copied["block-services"] ? "Copied!" : "Copy"}
              </button>
            </div>
            {blockDisabledReason("services") ? (
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{blockDisabledReason("services")}</p>
            ) : (
              <pre className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                {exports?.blocks.services || ""}
              </pre>
            )}
          </div>

          {/* FAQs */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>FAQs (Q/A)</p>
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {content ? `${content.faqSuggestions.length} items` : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => doCopy("block-faqs", "FAQs", exports?.blocks.faqs ?? "", Boolean(blockDisabledReason("faqs")))}
                className={buttonClasses("primary", Boolean(copied["block-faqs"]), Boolean(blockDisabledReason("faqs")))}
                disabled={Boolean(blockDisabledReason("faqs"))}
                title={blockDisabledReason("faqs") ?? "Copy the FAQs block."}
              >
                {copied["block-faqs"] ? "Copied!" : "Copy"}
              </button>
            </div>
            {blockDisabledReason("faqs") ? (
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{blockDisabledReason("faqs")}</p>
            ) : (
              <pre className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                {exports?.blocks.faqs || ""}
              </pre>
            )}
          </div>

          {/* Posts */}
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Posts</p>
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {content ? `${content.postIdeas.length} items` : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => doCopy("block-posts", "Posts", exports?.blocks.posts ?? "", Boolean(blockDisabledReason("posts")))}
                className={buttonClasses("primary", Boolean(copied["block-posts"]), Boolean(blockDisabledReason("posts")))}
                disabled={Boolean(blockDisabledReason("posts"))}
                title={blockDisabledReason("posts") ?? "Copy the posts block."}
              >
                {copied["block-posts"] ? "Copied!" : "Copy"}
              </button>
            </div>
            {blockDisabledReason("posts") ? (
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{blockDisabledReason("posts")}</p>
            ) : (
              <pre className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                {exports?.blocks.posts || ""}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Exports are built only from your <span className="font-medium">active</span> canonical draft (edited-over-generated). No Google API connections.
      </div>
    </div>
  );
}

