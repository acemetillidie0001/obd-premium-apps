/**
 * Review Responder Tier 5C receiver helpers for RD -> Review Responder (draft-only).
 *
 * This stores an "inbox" of drafts in sessionStorage so a page refresh
 * doesn't lose imported drafts. No auto-generation or auto-sending occurs.
 */

import type { RdToReviewResponderDraftHandoffV1 } from "@/lib/apps/reputation-dashboard/handoff";

export const REVIEW_RESPONDER_RD_DRAFTS_STORAGE_KEY_V1 =
  "obd:drafts:review-responder:rd:v1";

function safeSessionStorageSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to write Review Responder drafts to sessionStorage:", error);
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

export function storeReviewResponderRdDrafts(payload: RdToReviewResponderDraftHandoffV1): void {
  safeSessionStorageSet(REVIEW_RESPONDER_RD_DRAFTS_STORAGE_KEY_V1, payload);
}

export function readReviewResponderRdDrafts():
  | { payload: RdToReviewResponderDraftHandoffV1; expired: false }
  | { payload: null; expired: true }
  | { payload: null; expired: false } {
  const raw = safeSessionStorageGet(REVIEW_RESPONDER_RD_DRAFTS_STORAGE_KEY_V1);
  if (!raw) return { payload: null, expired: false };
  try {
    const parsed = JSON.parse(raw) as Partial<RdToReviewResponderDraftHandoffV1>;
    const expiresAt = typeof parsed.expiresAt === "string" ? parsed.expiresAt : "";
    const expires = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (!expires || Number.isNaN(expires) || Date.now() > expires) {
      safeSessionStorageRemove(REVIEW_RESPONDER_RD_DRAFTS_STORAGE_KEY_V1);
      return { payload: null, expired: true };
    }
    return { payload: parsed as RdToReviewResponderDraftHandoffV1, expired: false };
  } catch {
    return { payload: null, expired: false };
  }
}

export function clearReviewResponderRdDrafts(): void {
  safeSessionStorageRemove(REVIEW_RESPONDER_RD_DRAFTS_STORAGE_KEY_V1);
}


