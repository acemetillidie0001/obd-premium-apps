/**
 * SEO Audit & Roadmap → Apply-to-Inputs Handoff (Tier 5C+)
 *
 * Goals:
 * - Session-scoped (sessionStorage)
 * - TTL-guarded (expiresAt)
 * - User-initiated apply/dismiss only (no auto-apply)
 * - Deterministic, draft-only, intent-only (no generated content)
 *
 * NOTE: We intentionally scope keys per receiver app so only the intended target
 * sees the payload (avoids surprising prompts in unrelated apps).
 */

export type SeoAuditRoadmapSourceApp = "seo-audit-roadmap";

export type SeoAuditRoadmapHandoffTemplate =
  | "SERVICE_AREA_PAGE"
  | "FAQ_CLUSTER"
  | "SCHEMA_FIX_PACK"
  | "ONPAGE_REWRITE_BRIEF";

export type SeoAuditRoadmapSuggestedInputs = {
  serviceArea?: string;
  contentGap?: string;
  faqTopics?: string[];
  schemaType?: "LocalBusiness" | "FAQPage";
};

export type SeoAuditRoadmapApplyToInputsPayload = {
  sourceApp: SeoAuditRoadmapSourceApp;
  businessId: string;
  createdAt: string; // ISO
  expiresAt: string; // ISO (now + 10 min)
  findingId: string;
  category: string;
  recommendationType: string;
  template: SeoAuditRoadmapHandoffTemplate;
  suggestedInputs: SeoAuditRoadmapSuggestedInputs;
};

export type SeoAuditRoadmapApplyToInputsTargetApp =
  | "content-writer"
  | "faq-generator"
  | "business-schema-generator"
  | "local-seo-page-builder";

import { clearHandoff, createHandoff, readHandoff } from "@/lib/handoff/handoff";

export const SEO_AUDIT_APPLY_INPUTS_TTL_MS = 10 * 60 * 1000;

export const SEO_AUDIT_ROADMAP_APPLY_INPUTS_SESSION_KEYS_V1: Record<
  SeoAuditRoadmapApplyToInputsTargetApp,
  string
> = {
  "content-writer": "obd:handoff:seo-audit-roadmap:content-writer:apply-inputs:v1",
  "faq-generator": "obd:handoff:seo-audit-roadmap:faq-generator:apply-inputs:v1",
  "business-schema-generator":
    "obd:handoff:seo-audit-roadmap:business-schema-generator:apply-inputs:v1",
  "local-seo-page-builder":
    "obd:handoff:seo-audit-roadmap:local-seo-page-builder:apply-inputs:v1",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidIsoDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function parsePayload(raw: string): SeoAuditRoadmapApplyToInputsPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPlainObject(parsed)) return null;

  if (parsed.sourceApp !== "seo-audit-roadmap") return null;
  if (typeof parsed.businessId !== "string" || parsed.businessId.trim().length === 0)
    return null;
  if (!isValidIsoDateString(parsed.createdAt)) return null;
  if (!isValidIsoDateString(parsed.expiresAt)) return null;

  if (typeof parsed.findingId !== "string" || parsed.findingId.trim().length === 0)
    return null;
  if (typeof parsed.category !== "string" || parsed.category.trim().length === 0)
    return null;
  if (
    typeof parsed.recommendationType !== "string" ||
    parsed.recommendationType.trim().length === 0
  )
    return null;

  const template = parsed.template;
  const isTemplate =
    template === "SERVICE_AREA_PAGE" ||
    template === "FAQ_CLUSTER" ||
    template === "SCHEMA_FIX_PACK" ||
    template === "ONPAGE_REWRITE_BRIEF";
  if (!isTemplate) return null;

  const suggestedInputsRaw = parsed.suggestedInputs;
  if (!isPlainObject(suggestedInputsRaw)) return null;

  const suggestedInputs: SeoAuditRoadmapSuggestedInputs = {};
  if (
    typeof suggestedInputsRaw.serviceArea === "string" &&
    suggestedInputsRaw.serviceArea.trim().length > 0
  ) {
    suggestedInputs.serviceArea = suggestedInputsRaw.serviceArea.trim();
  }
  if (
    typeof suggestedInputsRaw.contentGap === "string" &&
    suggestedInputsRaw.contentGap.trim().length > 0
  ) {
    suggestedInputs.contentGap = suggestedInputsRaw.contentGap.trim();
  }
  if (Array.isArray(suggestedInputsRaw.faqTopics)) {
    const topics = suggestedInputsRaw.faqTopics
      .filter((t) => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (topics.length > 0) suggestedInputs.faqTopics = topics.slice(0, 25);
  }
  if (suggestedInputsRaw.schemaType === "LocalBusiness" || suggestedInputsRaw.schemaType === "FAQPage") {
    suggestedInputs.schemaType = suggestedInputsRaw.schemaType;
  }

  return {
    sourceApp: "seo-audit-roadmap",
    businessId: parsed.businessId.trim(),
    createdAt: parsed.createdAt,
    expiresAt: parsed.expiresAt,
    findingId: parsed.findingId.trim(),
    category: parsed.category.trim(),
    recommendationType: parsed.recommendationType.trim(),
    template,
    suggestedInputs,
  };
}

export function writeSeoAuditRoadmapApplyToInputsHandoff(args: {
  targetApp: SeoAuditRoadmapApplyToInputsTargetApp;
  businessId: string;
  findingId: string;
  category: string;
  recommendationType: string;
  template: SeoAuditRoadmapHandoffTemplate;
  suggestedInputs: SeoAuditRoadmapSuggestedInputs;
}): void {
  if (typeof window === "undefined") return;

  const basePayload = {
    sourceApp: "seo-audit-roadmap",
    businessId: args.businessId.trim(),
    findingId: args.findingId,
    category: args.category,
    recommendationType: args.recommendationType,
    template: args.template,
    suggestedInputs: args.suggestedInputs,
  } satisfies Omit<SeoAuditRoadmapApplyToInputsPayload, "createdAt" | "expiresAt">;

  const key = SEO_AUDIT_ROADMAP_APPLY_INPUTS_SESSION_KEYS_V1[args.targetApp];
  createHandoff(key, basePayload, SEO_AUDIT_APPLY_INPUTS_TTL_MS);
}

/**
 * Read + validate payload from sessionStorage for a given receiver.
 * - Enforces TTL
 * - Silently removes expired payloads
 */
export function readSeoAuditRoadmapApplyToInputsHandoff(
  targetApp: SeoAuditRoadmapApplyToInputsTargetApp
): SeoAuditRoadmapApplyToInputsPayload | null {
  const key = SEO_AUDIT_ROADMAP_APPLY_INPUTS_SESSION_KEYS_V1[targetApp];
  const parsed = readHandoff<unknown>(key);
  if (!parsed) return null;
  const payload = isPlainObject(parsed) ? parsePayload(JSON.stringify(parsed)) : null;
  if (!payload) return null;

  return payload;
}

export function clearSeoAuditRoadmapApplyToInputsHandoff(
  targetApp: SeoAuditRoadmapApplyToInputsTargetApp
): void {
  const key = SEO_AUDIT_ROADMAP_APPLY_INPUTS_SESSION_KEYS_V1[targetApp];
  clearHandoff(key);
}


