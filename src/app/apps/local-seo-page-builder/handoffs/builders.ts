import type { LocalSEODraft } from "../draft";
import {
  getActiveFaqs,
  getActivePageCopy,
  getActivePageSections,
  getActiveSchemaJsonLd,
  getActiveSeoPack,
} from "../draft";
import type { PageSections, TonePreset } from "../types";

/**
 * Tier 5C foundations — Local SEO Page Builder cross-app handoff payload builders.
 *
 * Notes:
 * - Draft-only: these payloads are designed for review-first import in target apps.
 * - JSON-safe: plain objects/arrays + ISO timestamps (no Date objects).
 * - Active content only: edited output overrides generated output via selectors.
 * - Transport is intentionally NOT wired here (sessionStorage + TTL handled by sender UI later).
 */

export const LOCAL_SEO_HANDOFF_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Tier 5C per-sender sessionStorage keys (sender writes; receiver reads + validates TTL).
export const LOCAL_SEO_TO_CONTENT_WRITER_HANDOFF_STORAGE_KEY_V1 =
  "obd:handoff:local-seo-page-builder:content-writer:v1";
export const LOCAL_SEO_TO_FAQ_GENERATOR_HANDOFF_STORAGE_KEY_V1 =
  "obd:handoff:local-seo-page-builder:faq-generator:v1";
export const LOCAL_SEO_TO_AI_HELP_DESK_HANDOFF_STORAGE_KEY_V1 =
  "obd:handoff:local-seo-page-builder:ai-help-desk:v1";

function nowIso(): string {
  return new Date().toISOString();
}

function computeExpiresAt(createdAtIso: string, ttlMs: number): string {
  const createdAt = new Date(createdAtIso);
  return new Date(createdAt.getTime() + ttlMs).toISOString();
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function dedupeStrings(values: string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v || "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeFaqItems(
  faqs: Array<{ question: string; answer: string }>,
  limit: number
): Array<{ question: string; answer: string }> {
  const items: Array<{ question: string; answer: string }> = [];
  const seen = new Set<string>();
  for (const faq of Array.isArray(faqs) ? faqs : []) {
    const q = (faq?.question || "").trim();
    const a = (faq?.answer || "").trim();
    if (!q || !a) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ question: q, answer: a });
    if (items.length >= limit) break;
  }
  return items;
}

function buildSourceMeta(draft: LocalSEODraft): {
  sourceApp: "local-seo-page-builder";
  city?: string;
  primaryService?: string;
  tonePreset?: TonePreset;
} {
  const form = draft.sourceInputs?.form;
  const city = cleanString(form?.city);
  const primaryService = cleanString(form?.primaryService);
  const tonePreset = form?.tonePreset;
  return {
    sourceApp: "local-seo-page-builder",
    ...(city ? { city } : {}),
    ...(primaryService ? { primaryService } : {}),
    ...(tonePreset ? { tonePreset } : {}),
  };
}

export type LocalSeoToContentWriterDraftPayloadV1 = {
  v: 1;
  type: "local_seo_page_builder_to_content_writer_draft";
  createdAt: string; // ISO
  expiresAt: string; // ISO
  sourceApp: "local-seo-page-builder";
  city?: string;
  primaryService?: string;
  tonePreset?: TonePreset;
  context: {
    businessName?: string;
    businessType?: string;
    city?: string;
    state?: string;
    primaryService?: string;
    secondaryServices?: string[];
    neighborhoods?: string[];
    targetAudience?: string;
    uniqueSellingPoints?: string;
    ctaPreference?: string;
    phone?: string;
    websiteUrl?: string;
    pageUrl?: string;
    outputFormat?: string;
    includeSchema?: boolean;
    tonePreset?: TonePreset;
  };
  content: {
    seoPack?: {
      metaTitle: string;
      metaDescription: string;
      slug: string;
      h1: string;
    };
    pageCopy: string;
    pageSections?: PageSections;
    faqs?: Array<{ question: string; answer: string }>;
    schemaJsonLd?: string;
  };
};

/**
 * Build a draft payload intended for AI Content Writer.
 * Uses ACTIVE Local SEO content (edited > generated).
 */
export function buildContentWriterDraftPayload(
  draft: LocalSEODraft
): LocalSeoToContentWriterDraftPayloadV1 {
  const createdAt = nowIso();
  const form = draft.sourceInputs?.form;

  const activeSeoPack = getActiveSeoPack(draft);
  const activePageCopy = getActivePageCopy(draft);
  const activeFaqs = normalizeFaqItems(getActiveFaqs(draft), 50);
  const activePageSections = getActivePageSections(draft);
  const activeSchemaJsonLd = cleanString(getActiveSchemaJsonLd(draft));

  const businessName = cleanString(form?.businessName);
  const businessType = cleanString(form?.businessType);
  const city = cleanString(form?.city);
  const state = cleanString(form?.state);
  const primaryService = cleanString(form?.primaryService);
  const tonePreset = form?.tonePreset;

  return {
    v: 1,
    type: "local_seo_page_builder_to_content_writer_draft",
    createdAt,
    expiresAt: computeExpiresAt(createdAt, LOCAL_SEO_HANDOFF_TTL_MS),
    ...buildSourceMeta(draft),
    context: {
      ...(businessName ? { businessName } : {}),
      ...(businessType ? { businessType } : {}),
      ...(city ? { city } : {}),
      ...(state ? { state } : {}),
      ...(primaryService ? { primaryService } : {}),
      ...(Array.isArray(form?.secondaryServices) && form.secondaryServices.length > 0
        ? { secondaryServices: dedupeStrings(form.secondaryServices, 25) }
        : {}),
      ...(Array.isArray(form?.neighborhoods) && form.neighborhoods.length > 0
        ? { neighborhoods: dedupeStrings(form.neighborhoods, 25) }
        : {}),
      ...(cleanString(form?.targetAudience) ? { targetAudience: form.targetAudience } : {}),
      ...(cleanString(form?.uniqueSellingPoints) ? { uniqueSellingPoints: form.uniqueSellingPoints } : {}),
      ...(cleanString(form?.ctaPreference) ? { ctaPreference: form.ctaPreference } : {}),
      ...(cleanString(form?.phone) ? { phone: form.phone } : {}),
      ...(cleanString(form?.websiteUrl) ? { websiteUrl: form.websiteUrl } : {}),
      ...(cleanString(form?.pageUrl) ? { pageUrl: form.pageUrl } : {}),
      ...(cleanString(form?.outputFormat) ? { outputFormat: form.outputFormat } : {}),
      ...(typeof form?.includeSchema === "boolean" ? { includeSchema: form.includeSchema } : {}),
      ...(tonePreset ? { tonePreset } : {}),
    },
    content: {
      ...(activeSeoPack
        ? {
            seoPack: {
              metaTitle: (activeSeoPack.metaTitle || "").trim(),
              metaDescription: (activeSeoPack.metaDescription || "").trim(),
              slug: (activeSeoPack.slug || "").trim(),
              h1: (activeSeoPack.h1 || "").trim(),
            },
          }
        : {}),
      pageCopy: activePageCopy,
      ...(activePageSections ? { pageSections: activePageSections } : {}),
      ...(activeFaqs.length > 0 ? { faqs: activeFaqs } : {}),
      ...(activeSchemaJsonLd ? { schemaJsonLd: activeSchemaJsonLd } : {}),
    },
  };
}

export type LocalSeoToFaqGeneratorSeedPayloadV1 = {
  v: 1;
  type: "local_seo_page_builder_to_faq_generator_seed";
  createdAt: string; // ISO
  expiresAt: string; // ISO
  sourceApp: "local-seo-page-builder";
  city?: string;
  primaryService?: string;
  tonePreset?: TonePreset;
  topic?: string;
  questions: string[];
  context?: {
    businessName?: string;
    businessType?: string;
    services?: string;
    city?: string;
    state?: string;
  };
};

/**
 * Build a seed payload intended for FAQ Generator (draft-only).
 * Uses ACTIVE Local SEO FAQs as seed questions (edited > generated).
 */
export function buildFaqGeneratorPayload(
  draft: LocalSEODraft
): LocalSeoToFaqGeneratorSeedPayloadV1 {
  const createdAt = nowIso();
  const form = draft.sourceInputs?.form;
  const activeFaqs = getActiveFaqs(draft);

  const businessName = cleanString(form?.businessName);
  const businessType = cleanString(form?.businessType);
  const city = cleanString(form?.city);
  const state = cleanString(form?.state);
  const primaryService = cleanString(form?.primaryService);
  const tonePreset = form?.tonePreset;

  const questions = dedupeStrings(
    (Array.isArray(activeFaqs) ? activeFaqs : []).map((f) => f?.question || ""),
    25
  );

  const topic = cleanString(
    [primaryService, city, state].filter(Boolean).join(" ")
  );

  const services = cleanString(
    dedupeStrings(
      [
        primaryService || "",
        ...(Array.isArray(form?.secondaryServices) ? form.secondaryServices : []),
      ],
      25
    ).join(", ")
  );

  return {
    v: 1,
    type: "local_seo_page_builder_to_faq_generator_seed",
    createdAt,
    expiresAt: computeExpiresAt(createdAt, LOCAL_SEO_HANDOFF_TTL_MS),
    ...buildSourceMeta(draft),
    ...(topic ? { topic } : {}),
    questions,
    ...(businessName || businessType || services || city || state
      ? {
          context: {
            ...(businessName ? { businessName } : {}),
            ...(businessType ? { businessType } : {}),
            ...(services ? { services } : {}),
            ...(city ? { city } : {}),
            ...(state ? { state } : {}),
          },
        }
      : {}),
  };
}

export type LocalSeoToHelpDeskSuggestionPayloadV1 = {
  v: 1;
  type: "local_seo_page_builder_to_ai_help_desk_faq_suggestion";
  createdAt: string; // ISO
  expiresAt: string; // ISO
  importedAt: string; // ISO (receiver-facing semantic timestamp)
  sourceApp: "local-seo-page-builder";
  city?: string;
  primaryService?: string;
  tonePreset?: TonePreset;
  mode: "qa";
  title: string;
  items: Array<{ question: string; answer: string }>;
  businessContext: {
    businessName?: string;
    businessType?: string;
    topic?: string;
  };
};

/**
 * Build a draft suggestion payload intended for AI Help Desk Knowledge.
 * Uses ACTIVE Local SEO FAQs (edited > generated).
 */
export function buildHelpDeskSuggestionPayload(
  draft: LocalSEODraft
): LocalSeoToHelpDeskSuggestionPayloadV1 {
  const createdAt = nowIso();
  const form = draft.sourceInputs?.form;

  const businessName = cleanString(form?.businessName);
  const businessType = cleanString(form?.businessType);
  const city = cleanString(form?.city);
  const state = cleanString(form?.state);
  const primaryService = cleanString(form?.primaryService);

  const topic =
    cleanString([primaryService, city].filter(Boolean).join(" ")) ??
    cleanString([city, state].filter(Boolean).join(" ")) ??
    cleanString(primaryService);

  const items = normalizeFaqItems(getActiveFaqs(draft), 50);

  const title =
    (topic ? `FAQs: ${topic}` : undefined) ??
    (businessName ? `FAQs: ${businessName}` : undefined) ??
    "FAQs";

  return {
    v: 1,
    type: "local_seo_page_builder_to_ai_help_desk_faq_suggestion",
    createdAt,
    expiresAt: computeExpiresAt(createdAt, LOCAL_SEO_HANDOFF_TTL_MS),
    importedAt: createdAt,
    ...buildSourceMeta(draft),
    mode: "qa",
    title,
    items,
    businessContext: {
      ...(businessName ? { businessName } : {}),
      ...(businessType ? { businessType } : {}),
      ...(topic ? { topic } : {}),
    },
  };
}

function safeSessionStorageSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to write handoff payload to sessionStorage:", error);
  }
}

/**
 * Store payloads to per-sender keys (Tier 5C convention).
 * NOTE: Intentionally not wired to UI yet.
 */
export function storeLocalSeoToContentWriterDraftHandoff(
  payload: LocalSeoToContentWriterDraftPayloadV1
): void {
  safeSessionStorageSet(LOCAL_SEO_TO_CONTENT_WRITER_HANDOFF_STORAGE_KEY_V1, payload);
}

export function storeLocalSeoToFaqGeneratorSeedHandoff(
  payload: LocalSeoToFaqGeneratorSeedPayloadV1
): void {
  safeSessionStorageSet(LOCAL_SEO_TO_FAQ_GENERATOR_HANDOFF_STORAGE_KEY_V1, payload);
}

export function storeLocalSeoToHelpDeskFaqSuggestionHandoff(
  payload: LocalSeoToHelpDeskSuggestionPayloadV1
): void {
  safeSessionStorageSet(LOCAL_SEO_TO_AI_HELP_DESK_HANDOFF_STORAGE_KEY_V1, payload);
}

function readHandoffPayloadFromKey<T extends { expiresAt: string }>(key: string):
  | { payload: T; expired: false }
  | { payload: null; expired: true }
  | { payload: null; expired: false } {
  if (typeof window === "undefined") return { payload: null, expired: false };
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { payload: null, expired: false };
    const parsed = JSON.parse(raw) as Partial<T>;
    const expiresAt = typeof parsed.expiresAt === "string" ? parsed.expiresAt : "";
    const expires = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (!expires || Number.isNaN(expires) || Date.now() > expires) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
      return { payload: null, expired: true };
    }
    return { payload: parsed as T, expired: false };
  } catch (error) {
    console.warn("Failed to read handoff payload from sessionStorage:", error);
    return { payload: null, expired: false };
  }
}

export function readLocalSeoToContentWriterDraftHandoff() {
  return readHandoffPayloadFromKey<LocalSeoToContentWriterDraftPayloadV1>(
    LOCAL_SEO_TO_CONTENT_WRITER_HANDOFF_STORAGE_KEY_V1
  );
}

export function readLocalSeoToFaqGeneratorSeedHandoff() {
  return readHandoffPayloadFromKey<LocalSeoToFaqGeneratorSeedPayloadV1>(
    LOCAL_SEO_TO_FAQ_GENERATOR_HANDOFF_STORAGE_KEY_V1
  );
}

export function readLocalSeoToHelpDeskFaqSuggestionHandoff() {
  return readHandoffPayloadFromKey<LocalSeoToHelpDeskSuggestionPayloadV1>(
    LOCAL_SEO_TO_AI_HELP_DESK_HANDOFF_STORAGE_KEY_V1
  );
}

export function clearLocalSeoToContentWriterDraftHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(LOCAL_SEO_TO_CONTENT_WRITER_HANDOFF_STORAGE_KEY_V1);
  } catch {
    // ignore
  }
}

export function clearLocalSeoToFaqGeneratorSeedHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(LOCAL_SEO_TO_FAQ_GENERATOR_HANDOFF_STORAGE_KEY_V1);
  } catch {
    // ignore
  }
}

export function clearLocalSeoToHelpDeskFaqSuggestionHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(LOCAL_SEO_TO_AI_HELP_DESK_HANDOFF_STORAGE_KEY_V1);
  } catch {
    // ignore
  }
}


