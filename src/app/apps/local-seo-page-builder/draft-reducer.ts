import type {
  LocalSEOPageBuilderRequest,
  LocalSEOPageBuilderResponse,
} from "./types";
import { hasEdits, type LocalSEODraft, type LocalSEOEdits } from "./draft";

export type DraftAction =
  | {
      type: "INIT_FROM_FORM";
      form: LocalSEOPageBuilderRequest;
    }
  | { type: "GENERATE_REQUEST"; clearGenerated: boolean }
  | {
      type: "GENERATE_SUCCESS";
      payloadUsed: LocalSEOPageBuilderRequest;
      response: LocalSEOPageBuilderResponse;
      preserveEdits: boolean;
    }
  | { type: "GENERATE_ERROR"; error: string }
  | {
      type: "APPLY_EDIT";
      key: keyof LocalSEOEdits;
      value: LocalSEOEdits[keyof LocalSEOEdits];
    }
  | { type: "RESET_SECTION"; key: keyof LocalSEOEdits }
  | { type: "RESET_ALL_EDITS" }
  | { type: "RESET_DRAFT"; form: LocalSEOPageBuilderRequest };

export function createInitialDraft(
  form: LocalSEOPageBuilderRequest
): LocalSEODraft {
  return {
    status: "draft",
    sourceInputs: {
      form,
      lastPayload: null,
    },
    generated: null,
    edits: {},
    error: null,
  };
}

function recomputeStatus(state: LocalSEODraft): LocalSEODraft["status"] {
  if (state.status === "generating") return "generating";
  if (state.error) return "error";
  if (state.generated) return hasEdits(state.edits) ? "edited" : "generated";
  return hasEdits(state.edits) ? "edited" : "draft";
}

export function draftReducer(state: LocalSEODraft, action: DraftAction): LocalSEODraft {
  switch (action.type) {
    case "INIT_FROM_FORM": {
      const next: LocalSEODraft = {
        ...state,
        sourceInputs: {
          ...state.sourceInputs,
          form: action.form,
        },
      };
      return { ...next, status: recomputeStatus(next) };
    }

    case "GENERATE_REQUEST": {
      const next: LocalSEODraft = {
        ...state,
        status: "generating",
        error: null,
        generated: action.clearGenerated ? null : state.generated,
      };
      return next;
    }

    case "GENERATE_SUCCESS": {
      const next: LocalSEODraft = {
        ...state,
        generated: action.response,
        error: null,
        sourceInputs: {
          ...state.sourceInputs,
          lastPayload: action.payloadUsed,
        },
        edits: action.preserveEdits ? state.edits : {},
      };
      return { ...next, status: recomputeStatus(next) };
    }

    case "GENERATE_ERROR": {
      const next: LocalSEODraft = {
        ...state,
        status: "error",
        error: action.error,
      };
      return next;
    }

    case "APPLY_EDIT": {
      const edits: LocalSEOEdits = { ...state.edits, [action.key]: action.value } as LocalSEOEdits;

      // If an edit exactly matches the generated baseline, drop it (keeps status deterministic).
      if (state.generated) {
        if (action.key === "pageCopy" && typeof action.value === "string") {
          if (action.value === state.generated.pageCopy) delete edits.pageCopy;
        }
        if (action.key === "schemaJsonLd" && typeof action.value === "string") {
          if (action.value === (state.generated.schemaJsonLd ?? "")) delete edits.schemaJsonLd;
        }
      }

      const next: LocalSEODraft = { ...state, edits };
      return { ...next, status: recomputeStatus(next) };
    }

    case "RESET_SECTION": {
      const edits: LocalSEOEdits = { ...state.edits };
      delete edits[action.key];
      const next: LocalSEODraft = { ...state, edits };
      return { ...next, status: recomputeStatus(next) };
    }

    case "RESET_ALL_EDITS": {
      const next: LocalSEODraft = { ...state, edits: {}, error: null };
      return { ...next, status: recomputeStatus(next) };
    }

    case "RESET_DRAFT": {
      return createInitialDraft(action.form);
    }

    default:
      return state;
  }
}


