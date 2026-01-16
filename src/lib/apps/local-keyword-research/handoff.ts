/**
 * LKRT Tier 5C handoffs (draft-only, apply-only receivers).
 *
 * Goals:
 * - Versioned payloads
 * - sessionStorage transport only
 * - TTL enforced and expired payloads cleared
 * - Tenant safety: businessId is REQUIRED for sender payloads; receiver must verify match
 * - Additive only: receivers should merge/fill-empty; never overwrite edits; never auto-apply
 */

import type { LocalKeywordResponse } from "@/app/api/local-keyword-research/types";

export const LKRT_HANDOFF_TTL_MS = 10 * 60 * 1000; // 10 minutes (align with other Tier 5C senders)
export const LKRT_HANDOFF_TTL_SECONDS = Math.round(LKRT_HANDOFF_TTL_MS / 1000);

export const LKRT_TO_LOCAL_SEO_SUGGESTIONS_STORAGE_KEY_V1 =
  "obd:handoff:lkrt:local-seo-suggestions:v1";

export const LKRT_TO_CONTENT_WRITER_SEEDS_STORAGE_KEY_V1 =
  "obd:handoff:lkrt:content-seeds:v1";

export type LkrtMetricsMode =
  | "Live Google Ads"
  | "Google Ads (Connected — Metrics Pending)"
  | "Mock Data"
  | "Estimated"
  | "No Metrics"
  | "—";

export type LkrtBaseHandoffV1 = {
  version: 1;
  sourceApp: "local-keyword-research";
  createdAt: string; // ISO
  expiresAt: string; // ISO
  ttlSeconds: number;
  from: {
    businessId: string;
    tenantId?: string;
  };
  context: {
    seedKeywords: string[];
    location: { city: string; state: string };
    nearMe: boolean;
    metricsMode: LkrtMetricsMode;
    runId?: string;
  };
  suggestions: {
    primaryKeywords: string[];
    secondaryKeywords: string[];
    topics: string[];
  };
};

export type LkrtToLocalSeoSuggestionsHandoffV1 = LkrtBaseHandoffV1 & {
  type: "lkrt:local-seo-suggestions:v1";
};

export type LkrtToContentWriterSeedsHandoffV1 = LkrtBaseHandoffV1 & {
  type: "lkrt:content-seeds:v1";
};

function nowIso(): string {
  return new Date().toISOString();
}

function computeExpiresAt(createdAtIso: string, ttlMs: number): string {
  const createdAt = new Date(createdAtIso);
  return new Date(createdAt.getTime() + ttlMs).toISOString();
}

function dedupeStrings(values: string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of Array.isArray(values) ? values : []) {
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

function getTopKeywords(result: LocalKeywordResponse | null | undefined): string[] {
  const kws = result?.topPriorityKeywords ?? [];
  return dedupeStrings(
    kws.map((k) => k.keyword),
    40
  );
}

function getTopicSeeds(result: LocalKeywordResponse | null | undefined): string[] {
  // Keep simple, additive-only: prefer model-provided blog ideas, fallback to cluster names.
  const blogIdeas = Array.isArray(result?.blogIdeas) ? result!.blogIdeas : [];
  if (blogIdeas.length > 0) {
    return dedupeStrings(blogIdeas, 25);
  }
  const clusters = Array.isArray(result?.keywordClusters) ? result!.keywordClusters : [];
  return dedupeStrings(
    clusters.map((c) => c.name).filter(Boolean),
    15
  );
}

export function buildLkrtHandoffBaseV1(args: {
  businessId: string;
  city: string;
  state: string;
  nearMe: boolean;
  seedKeywords: string[];
  metricsMode: LkrtMetricsMode;
  result: LocalKeywordResponse;
  createdAt?: string;
  runId?: string;
}): Omit<LkrtBaseHandoffV1, "type"> {
  const businessId = (args.businessId || "").trim();
  if (!businessId) {
    throw new Error("businessId is required for LKRT Tier 5C handoffs.");
  }

  const createdAt = args.createdAt ?? nowIso();
  const expiresAt = computeExpiresAt(createdAt, LKRT_HANDOFF_TTL_MS);

  const top = getTopKeywords(args.result);
  const primaryKeywords = top.slice(0, 15);
  const secondaryKeywords = top.slice(15, 40);

  const topics = getTopicSeeds(args.result);

  return {
    version: 1,
    sourceApp: "local-keyword-research",
    createdAt,
    expiresAt,
    ttlSeconds: LKRT_HANDOFF_TTL_SECONDS,
    from: { businessId },
    context: {
      seedKeywords: dedupeStrings(args.seedKeywords, 10),
      location: {
        city: (args.city || "Ocala").trim(),
        state: (args.state || "Florida").trim(),
      },
      nearMe: !!args.nearMe,
      metricsMode: args.metricsMode,
      ...(args.runId ? { runId: args.runId } : {}),
    },
    suggestions: {
      primaryKeywords,
      secondaryKeywords,
      topics,
    },
  };
}

export function buildLkrtToLocalSeoSuggestionsHandoffV1(args: {
  businessId: string;
  city: string;
  state: string;
  nearMe: boolean;
  seedKeywords: string[];
  metricsMode: LkrtMetricsMode;
  result: LocalKeywordResponse;
  createdAt?: string;
  runId?: string;
}): LkrtToLocalSeoSuggestionsHandoffV1 {
  return {
    type: "lkrt:local-seo-suggestions:v1",
    ...buildLkrtHandoffBaseV1(args),
  };
}

export function buildLkrtToContentWriterSeedsHandoffV1(args: {
  businessId: string;
  city: string;
  state: string;
  nearMe: boolean;
  seedKeywords: string[];
  metricsMode: LkrtMetricsMode;
  result: LocalKeywordResponse;
  createdAt?: string;
  runId?: string;
}): LkrtToContentWriterSeedsHandoffV1 {
  return {
    type: "lkrt:content-seeds:v1",
    ...buildLkrtHandoffBaseV1(args),
  };
}

function safeSessionStorageSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to write LKRT handoff payload to sessionStorage:", error);
  }
}

function safeSessionStorageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionStorageRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function readHandoffPayloadFromKey<T extends { expiresAt: string }>(key: string):
  | { payload: T; expired: false }
  | { payload: null; expired: true }
  | { payload: null; expired: false } {
  const raw = safeSessionStorageGet(key);
  if (!raw) return { payload: null, expired: false };

  try {
    const parsed = JSON.parse(raw) as Partial<T>;
    const expiresAt = typeof parsed.expiresAt === "string" ? parsed.expiresAt : "";
    const expires = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (!expires || Number.isNaN(expires) || Date.now() > expires) {
      safeSessionStorageRemove(key);
      return { payload: null, expired: true };
    }
    return { payload: parsed as T, expired: false };
  } catch (error) {
    console.warn("Failed to read LKRT handoff payload from sessionStorage:", error);
    return { payload: null, expired: false };
  }
}

export function storeLkrtToLocalSeoSuggestionsHandoff(payload: LkrtToLocalSeoSuggestionsHandoffV1): void {
  safeSessionStorageSet(LKRT_TO_LOCAL_SEO_SUGGESTIONS_STORAGE_KEY_V1, payload);
}

export function storeLkrtToContentWriterSeedsHandoff(payload: LkrtToContentWriterSeedsHandoffV1): void {
  safeSessionStorageSet(LKRT_TO_CONTENT_WRITER_SEEDS_STORAGE_KEY_V1, payload);
}

export function readLkrtToLocalSeoSuggestionsHandoff() {
  return readHandoffPayloadFromKey<LkrtToLocalSeoSuggestionsHandoffV1>(
    LKRT_TO_LOCAL_SEO_SUGGESTIONS_STORAGE_KEY_V1
  );
}

export function readLkrtToContentWriterSeedsHandoff() {
  return readHandoffPayloadFromKey<LkrtToContentWriterSeedsHandoffV1>(
    LKRT_TO_CONTENT_WRITER_SEEDS_STORAGE_KEY_V1
  );
}

export function clearLkrtToLocalSeoSuggestionsHandoff(): void {
  safeSessionStorageRemove(LKRT_TO_LOCAL_SEO_SUGGESTIONS_STORAGE_KEY_V1);
}

export function clearLkrtToContentWriterSeedsHandoff(): void {
  safeSessionStorageRemove(LKRT_TO_CONTENT_WRITER_SEEDS_STORAGE_KEY_V1);
}


