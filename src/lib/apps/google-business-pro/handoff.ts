/**
 * Google Business Profile Pro — Tier 5C handoffs (draft-only, apply-only receivers).
 *
 * Goals:
 * - Versioned payloads
 * - sessionStorage transport only
 * - TTL enforced and expired payloads cleared
 * - Safety: receiver must require explicit Apply/Dismiss (no auto-generation, no overwrite)
 *
 * NOTE: GBP Pro does not currently have a stable tenant/businessId concept, so we rely on
 * "apply-only" + "additive-only" receiver behavior and explicit user confirmation.
 */

export const GBP_HANDOFF_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const GBP_HANDOFF_TTL_SECONDS = Math.round(GBP_HANDOFF_TTL_MS / 1000);

export const GBP_TO_CONTENT_WRITER_STORAGE_KEY_V1 =
  "obd:handoff:gbp-pro:content-writer-inputs:v1";

export const GBP_TO_SCHEMA_GENERATOR_STORAGE_KEY_V1 =
  "obd:handoff:gbp-pro:schema-inputs:v1";

export type GbpBaseHandoffV1 = {
  version: 1;
  sourceApp: "google-business-pro";
  createdAt: string; // ISO
  expiresAt: string; // ISO
  ttlSeconds: number;
  context: {
    businessName?: string;
    businessType?: string;
    city?: string;
    state?: string;
    websiteUrl?: string;
    servicesInput?: string; // free-text list
  };
};

export type GbpToContentWriterBlock =
  | "business-description"
  | "services"
  | "faqs"
  | "posts"
  | "keywords";

export type GbpToContentWriterHandoffV1 = GbpBaseHandoffV1 & {
  type: "gbp:content-writer-inputs:v1";
  intent: "turn-into-website-content";
  block: {
    kind: GbpToContentWriterBlock;
    title: string;
    text: string;
  };
};

export type GbpToSchemaGeneratorHandoffV1 = GbpBaseHandoffV1 & {
  type: "gbp:schema-inputs:v1";
  intent: "additive-apply";
  facts: {
    // NAP-ish (optional; only set if present in sender)
    phone?: string;
    streetAddress?: string;
    postalCode?: string;
    // Content-derived
    services?: string[];
    faqs?: Array<{ question: string; answer: string }>;
  };
};

function nowIso(): string {
  return new Date().toISOString();
}

function computeExpiresAt(createdAtIso: string, ttlMs: number): string {
  const createdAt = new Date(createdAtIso);
  return new Date(createdAt.getTime() + ttlMs).toISOString();
}

function safeSessionStorageSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to write GBP handoff payload to sessionStorage:", error);
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
    console.warn("Failed to read GBP handoff payload from sessionStorage:", error);
    return { payload: null, expired: false };
  }
}

export function buildGbpToContentWriterHandoffV1(args: {
  block: { kind: GbpToContentWriterBlock; title: string; text: string };
  context: GbpBaseHandoffV1["context"];
  createdAt?: string;
}): GbpToContentWriterHandoffV1 {
  const createdAt = args.createdAt ?? nowIso();
  const expiresAt = computeExpiresAt(createdAt, GBP_HANDOFF_TTL_MS);
  return {
    type: "gbp:content-writer-inputs:v1",
    intent: "turn-into-website-content",
    version: 1,
    sourceApp: "google-business-pro",
    createdAt,
    expiresAt,
    ttlSeconds: GBP_HANDOFF_TTL_SECONDS,
    context: args.context ?? {},
    block: {
      kind: args.block.kind,
      title: (args.block.title || "").trim(),
      text: (args.block.text || "").trim(),
    },
  };
}

export function storeGbpToContentWriterHandoff(payload: GbpToContentWriterHandoffV1): void {
  safeSessionStorageSet(GBP_TO_CONTENT_WRITER_STORAGE_KEY_V1, payload);
}

export function readGbpToContentWriterHandoff() {
  return readHandoffPayloadFromKey<GbpToContentWriterHandoffV1>(GBP_TO_CONTENT_WRITER_STORAGE_KEY_V1);
}

export function clearGbpToContentWriterHandoff(): void {
  safeSessionStorageRemove(GBP_TO_CONTENT_WRITER_STORAGE_KEY_V1);
}

export function buildGbpToSchemaGeneratorHandoffV1(args: {
  facts: GbpToSchemaGeneratorHandoffV1["facts"];
  context: GbpBaseHandoffV1["context"];
  createdAt?: string;
}): GbpToSchemaGeneratorHandoffV1 {
  const createdAt = args.createdAt ?? nowIso();
  const expiresAt = computeExpiresAt(createdAt, GBP_HANDOFF_TTL_MS);
  return {
    type: "gbp:schema-inputs:v1",
    intent: "additive-apply",
    version: 1,
    sourceApp: "google-business-pro",
    createdAt,
    expiresAt,
    ttlSeconds: GBP_HANDOFF_TTL_SECONDS,
    context: args.context ?? {},
    facts: args.facts ?? {},
  };
}

export function storeGbpToSchemaGeneratorHandoff(payload: GbpToSchemaGeneratorHandoffV1): void {
  safeSessionStorageSet(GBP_TO_SCHEMA_GENERATOR_STORAGE_KEY_V1, payload);
}

export function readGbpToSchemaGeneratorHandoff() {
  return readHandoffPayloadFromKey<GbpToSchemaGeneratorHandoffV1>(GBP_TO_SCHEMA_GENERATOR_STORAGE_KEY_V1);
}

export function clearGbpToSchemaGeneratorHandoff(): void {
  safeSessionStorageRemove(GBP_TO_SCHEMA_GENERATOR_STORAGE_KEY_V1);
}

