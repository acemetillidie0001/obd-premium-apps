import type { GoogleBusinessAuditResult, GoogleBusinessWizardResult } from "./types";

export type GoogleBusinessSourceMode = "Wizard" | "Audit" | "Pro";

/**
 * Canonical GBP Draft Content (Tier 5B)
 *
 * This is the shape all rendering/exports resolve from via `getActiveGbpDraft()`.
 * Notes:
 * - `audit` is read-only in the UI today, but still lives in the canonical model.
 * - `content` contains all editable GBP outputs (descriptions, services, FAQs, posts, etc).
 */
export interface GoogleBusinessDraftContent {
  audit?: GoogleBusinessAuditResult;
  content?: GoogleBusinessWizardResult;
}

/**
 * Canonical Draft Model for Google Business Profile Pro (Tier 5B)
 *
 * MANDATORY RULES:
 * - Edited content always overrides generated content.
 * - Regenerate must NEVER wipe `editedContent`.
 * - Reset clears `editedContent` only.
 * - All rendering/exports must resolve from `getActiveGbpDraft()`.
 */
export interface GoogleBusinessDraft {
  /** Stable, non-regenerating id for this draft (client-session scoped). */
  id: string;
  /** Where the latest generated content came from. */
  sourceMode: GoogleBusinessSourceMode;
  /** Raw AI output captured at generation time (canonical baseline). */
  generatedContent: GoogleBusinessDraftContent | null;
  /** User-edited snapshot (full override; never implicitly merged at read-time). */
  editedContent: GoogleBusinessDraftContent | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/**
 * Canonical selector: returns edited snapshot if present, otherwise generated.
 * Never merges implicitly. Never recomputes content.
 */
export function getActiveGbpDraft(draft: GoogleBusinessDraft): GoogleBusinessDraftContent | null {
  return draft.editedContent ?? draft.generatedContent;
}

export function hasAnyGbpEdits(draft: GoogleBusinessDraft): boolean {
  return draft.editedContent !== null;
}

export function canBuildProResultFromDraft(active: GoogleBusinessDraftContent | null): boolean {
  return Boolean(active?.audit && active?.content);
}


