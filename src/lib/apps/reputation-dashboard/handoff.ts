/**
 * Reputation Dashboard Tier 5C handoffs (draft-only).
 *
 * Goals:
 * - Versioned payloads
 * - sessionStorage transport only
 * - TTL enforced and expired payloads cleared
 * - Tenant safety: businessId is REQUIRED; receiver must verify match
 * - Draft-only: receivers should never auto-generate or auto-send
 */

import type { ReviewInput, ReviewPlatform } from "./types";
import { getHandoffHash } from "@/lib/utils/handoff-guard";

export const RD_HANDOFF_TTL_MS = 10 * 60 * 1000; // 10 minutes (align with other Tier 5C senders)
export const RD_HANDOFF_TTL_SECONDS = Math.round(RD_HANDOFF_TTL_MS / 1000);

export const RD_TO_REVIEW_RESPONDER_DRAFT_STORAGE_KEY_V1 =
  "obd:handoff:rd:review-responder-draft:v1";

export type RdReviewResponderDraftReviewV1 = {
  /** Deterministic, stable identifier derived from deterministic fields (not PII). */
  id: string;
  platform: ReviewPlatform;
  platformLabel: string;
  rating: number;
  reviewDate: string;
  reviewText: string;
  responded: boolean;
};

export type RdToReviewResponderDraftHandoffV1 = {
  version: 1;
  type: "rd:review-responder-draft:v1";
  sourceApp: "reputation-dashboard";
  createdAt: string; // ISO
  expiresAt: string; // ISO
  ttlSeconds: number;
  from: {
    businessId: string;
    tenantId?: string;
  };
  context: {
    snapshotId: string;
  };
  selectedReviews: RdReviewResponderDraftReviewV1[];
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
    console.warn("Failed to write RD handoff payload to sessionStorage:", error);
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
    console.warn("Failed to read RD handoff payload from sessionStorage:", error);
    return { payload: null, expired: false };
  }
}

function platformLabel(p: ReviewPlatform): string {
  return p;
}

/**
 * Compute a deterministic, stable review identifier from deterministic fields.
 * Note: we intentionally exclude authorName to avoid introducing additional PII.
 */
export function getRdReviewStableIdV1(review: Pick<ReviewInput, "platform" | "reviewDate" | "rating" | "reviewText">): string {
  return getHandoffHash({
    v: 1,
    platform: review.platform,
    reviewDate: (review.reviewDate || "").trim(),
    rating: Math.round(Number(review.rating) || 0),
    reviewText: (review.reviewText || "").trim(),
  });
}

export function buildRdToReviewResponderDraftHandoffV1(args: {
  businessId: string;
  snapshotId: string;
  selectedReviews: ReviewInput[];
  createdAt?: string;
}): RdToReviewResponderDraftHandoffV1 {
  const businessId = (args.businessId || "").trim();
  if (!businessId) {
    throw new Error("businessId is required for RD Tier 5C handoffs.");
  }
  const snapshotId = (args.snapshotId || "").trim();
  if (!snapshotId) {
    throw new Error("snapshotId is required for RD Tier 5C handoffs.");
  }

  const createdAt = args.createdAt ?? nowIso();
  const expiresAt = computeExpiresAt(createdAt, RD_HANDOFF_TTL_MS);

  const selectedReviews: RdReviewResponderDraftReviewV1[] = (Array.isArray(args.selectedReviews) ? args.selectedReviews : [])
    .map((r) => {
      const id = getRdReviewStableIdV1(r);
      return {
        id,
        platform: r.platform,
        platformLabel: platformLabel(r.platform),
        rating: Math.round(Number(r.rating) || 0),
        reviewDate: (r.reviewDate || "").trim(),
        reviewText: (r.reviewText || "").trim(),
        responded: !!r.responded,
      };
    })
    .filter((r) => !!r.reviewText && !!r.reviewDate && !!r.platform);

  return {
    version: 1,
    type: "rd:review-responder-draft:v1",
    sourceApp: "reputation-dashboard",
    createdAt,
    expiresAt,
    ttlSeconds: RD_HANDOFF_TTL_SECONDS,
    from: { businessId },
    context: { snapshotId },
    selectedReviews,
  };
}

export function storeRdToReviewResponderDraftHandoff(payload: RdToReviewResponderDraftHandoffV1): void {
  safeSessionStorageSet(RD_TO_REVIEW_RESPONDER_DRAFT_STORAGE_KEY_V1, payload);
}

export function readRdToReviewResponderDraftHandoff() {
  return readHandoffPayloadFromKey<RdToReviewResponderDraftHandoffV1>(
    RD_TO_REVIEW_RESPONDER_DRAFT_STORAGE_KEY_V1
  );
}

export function clearRdToReviewResponderDraftHandoff(): void {
  safeSessionStorageRemove(RD_TO_REVIEW_RESPONDER_DRAFT_STORAGE_KEY_V1);
}


