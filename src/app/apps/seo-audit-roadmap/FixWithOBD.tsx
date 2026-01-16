"use client";

import Link from "next/link";
import { getFixWithOBDSuggestions, type FindingStatus, type Tier5SectionId } from "./fix-with-obd";
import {
  writeSeoAuditRoadmapApplyToInputsHandoff,
  type SeoAuditRoadmapApplyToInputsTargetApp,
  type SeoAuditRoadmapHandoffTemplate,
  type SeoAuditRoadmapSuggestedInputs,
} from "@/lib/apps/seo-audit-roadmap/apply-to-inputs-handoff";

export default function FixWithOBD({
  isDark,
  sectionId,
  categoryKey,
  categoryLabel,
  status,
  businessId,
  sourceInputs,
}: {
  isDark: boolean;
  sectionId: Tier5SectionId;
  categoryKey: string;
  categoryLabel: string;
  status: FindingStatus;
  businessId: string | null;
  sourceInputs: { primaryService: string; city: string; state: string } | null;
}) {
  const suggestions = getFixWithOBDSuggestions({ sectionId, categoryKey, status });
  if (!suggestions.length) return null;

  const cardClass = `mt-3 rounded-lg border p-3 ${
    isDark ? "border-slate-700 bg-slate-950/30" : "border-slate-200 bg-white"
  }`;

  const titleText = isDark ? "text-slate-200" : "text-slate-800";
  const mutedText = isDark ? "text-slate-400" : "text-slate-600";

  const chipClass = `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
    isDark
      ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
  }`;

  return (
    <div className={cardClass}>
      <div className={`text-xs font-semibold ${titleText}`}>Fix with OBD</div>
      <div className={`mt-1 text-xs ${mutedText}`}>
        This will pre-fill draft inputs only. Nothing is generated or published automatically.
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((s) => {
          const targetApp = s.id as SeoAuditRoadmapApplyToInputsTargetApp;
          const template = pickTemplate({ targetApp, categoryKey, status });
          const ctaLabel = templateToCtaLabel(template);
          return (
          <Link
            key={s.id}
            href={s.href}
            className={chipClass}
            title="Prefills draft inputs only."
            onClick={(e) => {
              // SessionStorage is per-tab. Only write payload for a normal (same-tab) click.
              if (
                e.defaultPrevented ||
                e.button !== 0 ||
                e.metaKey ||
                e.ctrlKey ||
                e.shiftKey ||
                e.altKey
              ) {
                return;
              }

              // Tenant safety: if we cannot resolve a businessId, skip handoff (navigation still works).
              if (!businessId) return;

              const suggestedInputs = buildSuggestedInputs({
                targetApp,
                sectionId,
                categoryKey,
                categoryLabel,
                sourceInputs,
              });

              writeSeoAuditRoadmapApplyToInputsHandoff({
                targetApp,
                businessId,
                findingId: `${sectionId}:${categoryKey}`,
                category: categoryLabel || categoryKey,
                recommendationType: status,
                template,
                suggestedInputs,
              });
            }}
          >
            <div className="min-w-0">
              <div className="truncate">{ctaLabel}</div>
              <div className={`mt-0.5 font-normal ${mutedText}`}>{s.description}</div>
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
}

function pickTemplate(args: {
  targetApp: SeoAuditRoadmapApplyToInputsTargetApp;
  categoryKey: string;
  status: FindingStatus;
}): SeoAuditRoadmapHandoffTemplate {
  // Deterministic mapping: chosen from finding category + type (we treat status as type),
  // but also constrained by the destination tool (so the template is always relevant).
  if (args.targetApp === "local-seo-page-builder") return "SERVICE_AREA_PAGE";
  if (args.targetApp === "faq-generator") return "FAQ_CLUSTER";
  if (args.targetApp === "business-schema-generator") return "SCHEMA_FIX_PACK";
  return "ONPAGE_REWRITE_BRIEF";
}

function templateToCtaLabel(template: SeoAuditRoadmapHandoffTemplate): string {
  switch (template) {
    case "SERVICE_AREA_PAGE":
      return "Create Service Area Page Draft";
    case "FAQ_CLUSTER":
      return "Create FAQ Cluster Draft";
    case "SCHEMA_FIX_PACK":
      return "Open Schema Fix Pack";
    case "ONPAGE_REWRITE_BRIEF":
    default:
      return "Create On-Page Rewrite Brief";
  }
}

function buildSuggestedInputs(args: {
  targetApp: SeoAuditRoadmapApplyToInputsTargetApp;
  sectionId: Tier5SectionId;
  categoryKey: string;
  categoryLabel: string;
  sourceInputs: { primaryService: string; city: string; state: string } | null;
}): SeoAuditRoadmapSuggestedInputs {
  const primaryService = (args.sourceInputs?.primaryService || "").trim();
  const city = (args.sourceInputs?.city || "").trim();
  const state = (args.sourceInputs?.state || "").trim();

  const service = primaryService || "your primary service";
  const place = [city, state].filter(Boolean).join(", ") || "your service area";

  if (args.targetApp === "local-seo-page-builder") {
    return {
      // Receiver parses "City, State" into inputs when possible.
      serviceArea: [city, state].filter(Boolean).join(", "),
      // Intent-only: Local SEO Page Builder uses this as a safe primaryService suggestion (fill-empty-only).
      contentGap: primaryService || "",
    };
  }

  if (args.targetApp === "business-schema-generator") {
    // Heuristic: content/FAQ recommendations -> FAQPage; otherwise LocalBusiness.
    const schemaType = args.categoryKey === "content-length" ? "FAQPage" : "LocalBusiness";
    return {
      schemaType,
      serviceArea: [city, state].filter(Boolean).join(", "),
    };
  }

  if (args.targetApp === "faq-generator") {
    const base = `${service} in ${place}`;
    const topics =
      args.categoryKey === "content-length"
        ? [
            base,
            `${service} pricing`,
            `How ${service} works`,
            `How long does ${service} take?`,
            `Do you serve ${place}?`,
          ]
        : [base];

    return {
      serviceArea: [city, state].filter(Boolean).join(", "),
      faqTopics: topics,
    };
  }

  // content-writer
  const contentGap = (() => {
    switch (args.categoryKey) {
      case "title-tag":
        return `Title tag for ${service} in ${place}`;
      case "meta-description":
        return `Meta description for ${service} in ${place}`;
      case "h1-tag":
      case "heading-structure":
        return `Headings + section structure for ${service} in ${place}`;
      case "conversion-signals":
        return `Conversion-focused copy for ${service} in ${place}`;
      case "images-alt":
        return `Image alt text for ${service} in ${place}`;
      case "content-length":
      default:
        return `Service page coverage for ${service} in ${place}`;
    }
  })();

  return {
    serviceArea: [city, state].filter(Boolean).join(", "),
    contentGap,
  };
}


