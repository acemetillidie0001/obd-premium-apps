import { mergeNodesAdditive } from "./handoffReceiver";

export type DraftStatus = "draft" | "generated" | "edited";

export interface SchemaDraft {
  /**
   * Stable per page-load draft id.
   * Use `createSchemaDraft()` to initialize with `crypto.randomUUID()`.
   */
  id: string;
  generatedJsonld: string | null;
  editedJsonld: string | null;
  lastGeneratedAt: string | null; // ISO
  lastEditedAt: string | null; // ISO
}

export function safeJsonParse<T = unknown>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableNormalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableNormalizeValue);
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = stableNormalizeValue(value[key]);
  }
  return out;
}

/**
 * Normalize any JSON string into a stable, pretty-printed representation.
 * If the input is not valid JSON, returns a trimmed version of the original string.
 */
export function normalizeJsonString(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const parsed = safeJsonParse(trimmed);
  if (parsed === null) return trimmed;

  const normalized = stableNormalizeValue(parsed);
  return JSON.stringify(normalized, null, 2);
}

export function getActiveSchemaJson(draft: SchemaDraft): string {
  return draft.editedJsonld ?? draft.generatedJsonld ?? "";
}

export function getDraftStatus(draft: SchemaDraft): DraftStatus {
  if (draft.editedJsonld) return "edited";
  if (draft.generatedJsonld) return "generated";
  return "draft";
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeOrNull(value: string | null): string | null {
  if (value === null) return null;
  const normalized = normalizeJsonString(value);
  return normalized ? normalized : null;
}

/**
 * Apply generator output without touching user edits.
 */
export function applyGeneratedSchema(draft: SchemaDraft, nextGenerated: string | null): SchemaDraft {
  return {
    ...draft,
    generatedJsonld: normalizeOrNull(nextGenerated),
    lastGeneratedAt: nextGenerated ? nowIso() : null,
  };
}

/**
 * Apply inbound schema nodes additively into the draft's active schema,
 * committing the result as a generated update (never overwriting edits).
 */
export function applyAdditiveNodes(
  draft: SchemaDraft,
  incomingNodes: Record<string, any>[]
): SchemaDraft {
  const activeJson = getActiveSchemaJson(draft);

  try {
    const merged = mergeNodesAdditive(activeJson, incomingNodes);
    return applyGeneratedSchema(draft, merged);
  } catch {
    // Fail-safe: do not mutate draft if JSON parsing/merging fails.
    return draft;
  }
}

/**
 * Apply user-edited schema (becomes authoritative if present).
 */
export function applyEditedSchema(draft: SchemaDraft, nextEdited: string | null): SchemaDraft {
  return {
    ...draft,
    editedJsonld: normalizeOrNull(nextEdited),
    lastEditedAt: nextEdited ? nowIso() : null,
  };
}

/**
 * Discard edits only, reverting active schema back to generated.
 */
export function resetToGenerated(draft: SchemaDraft): SchemaDraft {
  return {
    ...draft,
    editedJsonld: null,
    lastEditedAt: null,
  };
}

/**
 * Clear everything (generated + edited). Keeps the same id (still stable for this page load).
 */
export function resetAll(draft: SchemaDraft): SchemaDraft {
  return {
    ...draft,
    generatedJsonld: null,
    editedJsonld: null,
    lastGeneratedAt: null,
    lastEditedAt: null,
  };
}

function fallbackId(): string {
  // Not cryptographically strong, but avoids throwing in restricted runtimes.
  return `draft_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createSchemaDraft(): SchemaDraft {
  const id =
    typeof globalThis !== "undefined" &&
    "crypto" in globalThis &&
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : fallbackId();

  return {
    id,
    generatedJsonld: null,
    editedJsonld: null,
    lastGeneratedAt: null,
    lastEditedAt: null,
  };
}


