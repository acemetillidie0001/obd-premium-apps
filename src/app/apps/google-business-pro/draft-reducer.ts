import type { GoogleBusinessAuditResult, GoogleBusinessWizardResult } from "./types";
import type { GoogleBusinessDraft, GoogleBusinessDraftContent, GoogleBusinessSourceMode } from "./draft";
import { getActiveGbpDraft } from "./draft";

export type GoogleBusinessDraftAction =
  | { type: "SET_SOURCE_MODE"; sourceMode: GoogleBusinessSourceMode }
  | { type: "UPSERT_GENERATED_AUDIT"; audit: GoogleBusinessAuditResult; preserveEdits: true }
  | { type: "UPSERT_GENERATED_WIZARD"; content: GoogleBusinessWizardResult; preserveEdits: true }
  | {
      type: "SET_EDITED_SNAPSHOT";
      /** Full edited snapshot (or null to clear edits). */
      editedContent: GoogleBusinessDraftContent | null;
    }
  | { type: "RESET_ALL_EDITS" }
  | { type: "CLEAR_GENERATED_AND_EDITS" };

function nowIso(): string {
  return new Date().toISOString();
}

function createDraftId(): string {
  // Client-side stable id (not regenerated on regenerate/reset edits).
  // (We avoid persistence for now to match other draft-only apps.)
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // fallthrough
  }
  return `gbp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createInitialGoogleBusinessDraft(): GoogleBusinessDraft {
  const ts = nowIso();
  return {
    id: createDraftId(),
    sourceMode: "Wizard",
    generatedContent: null,
    editedContent: null,
    createdAt: ts,
    updatedAt: ts,
  };
}

function touch(state: GoogleBusinessDraft): GoogleBusinessDraft {
  return { ...state, updatedAt: nowIso() };
}

/**
 * Utility for explicit snapshot edits:
 * - Baseline is current active content (edited or generated).
 * - This is used ONLY at write-time (save/reset), never at read-time.
 */
export function buildEditedSnapshot(
  draft: GoogleBusinessDraft,
  updater: (baseline: GoogleBusinessDraftContent) => GoogleBusinessDraftContent
): GoogleBusinessDraftContent {
  const baseline = getActiveGbpDraft(draft) ?? {};
  return updater(baseline);
}

export function googleBusinessDraftReducer(
  state: GoogleBusinessDraft,
  action: GoogleBusinessDraftAction
): GoogleBusinessDraft {
  switch (action.type) {
    case "SET_SOURCE_MODE": {
      return touch({ ...state, sourceMode: action.sourceMode });
    }

    case "UPSERT_GENERATED_AUDIT": {
      const nextGenerated: GoogleBusinessDraftContent = {
        ...(state.generatedContent ?? {}),
        audit: action.audit,
      };
      return touch({
        ...state,
        sourceMode: "Audit",
        generatedContent: nextGenerated,
        editedContent: action.preserveEdits ? state.editedContent : null,
      });
    }

    case "UPSERT_GENERATED_WIZARD": {
      const nextGenerated: GoogleBusinessDraftContent = {
        ...(state.generatedContent ?? {}),
        content: action.content,
      };
      return touch({
        ...state,
        sourceMode: "Wizard",
        generatedContent: nextGenerated,
        editedContent: action.preserveEdits ? state.editedContent : null,
      });
    }

    case "SET_EDITED_SNAPSHOT": {
      return touch({ ...state, editedContent: action.editedContent });
    }

    case "RESET_ALL_EDITS": {
      return touch({ ...state, editedContent: null });
    }

    case "CLEAR_GENERATED_AND_EDITS": {
      return touch({ ...state, generatedContent: null, editedContent: null });
    }

    default:
      return state;
  }
}


