import type { LogoConcept, LogoGeneratorResponse, LogoImage, LogoStyle, PersonalityStyle } from "./types";

/**
 * Tier 5B Canonical Data Model (AI Logo Generator)
 *
 * Goals:
 * - Stable IDs not based on array indexes
 * - Versioned output sets (future-proof for edits + regen)
 * - Pure helper functions (UI wiring happens later)
 */

export type LogoBriefSnapshot = {
  businessName: string;
  businessType: string;
  services?: string;
  city?: string;
  state?: string;
  brandVoice?: string;
  personalityStyle?: PersonalityStyle;
  logoStyle?: LogoStyle;
  colorPreferences?: string;
  includeBusinessName: boolean;
  variationCount: number;
  outputFormat?: "PNG" | "PNG_Transparent" | "JPG" | "" | string;
  generateImages: boolean;
};

export type LogoItemEditedFlags = {
  name?: boolean;
  favorite?: boolean;
};

/**
 * Canonical logo item for UI state and future persistence.
 * NOTE: `id` is always a stable UUID (never index-based).
 */
export type LogoItem = {
  id: string;
  createdAt: string; // ISO

  // Traceability back to API response (optional, for debugging / future reconciliation)
  sourceConceptId?: number;

  // Renderable fields
  name: string;
  description: string;
  styleNotes: string;
  colorPalette: string[];
  prompt: string;
  imageUrl: string | null;
  imageError?: string;

  // User-controlled fields
  favorite: boolean;
  edited: LogoItemEditedFlags;
};

/**
 * Canonical version set (Tier 5B)
 * - `id` is stable UUID
 * - `briefSnapshot` freezes the input context used to generate the set
 * - `items` are the canonical LogoItems for the set
 */
export type LogoVersionSet = {
  id: string;
  createdAt: string; // ISO
  briefSnapshot: LogoBriefSnapshot;
  items: LogoItem[];
};

function createUuid(): string {
  // Required: prefer crypto.randomUUID when available
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `logo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function coerceString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function findImageForConcept(images: LogoImage[], conceptId: number): LogoImage | undefined {
  return images.find((img) => img.conceptId === conceptId);
}

/**
 * Returns the logo list for the active version set (or a safe fallback).
 */
export function getActiveLogos(
  versionSets: LogoVersionSet[],
  activeSetId: string | null
): LogoItem[] {
  if (!versionSets.length) return [];
  if (!activeSetId) return versionSets[0]?.items ?? [];
  return versionSets.find((s) => s.id === activeSetId)?.items ?? versionSets[0]?.items ?? [];
}

/**
 * Create a new version set from an API response.
 * - Generates stable UUIDs for the set and each item
 * - Keeps optional traceability (`sourceConceptId`)
 */
export function createVersionSetFromApiResponse(opts: {
  briefSnapshot: LogoBriefSnapshot;
  apiLogos: Pick<LogoGeneratorResponse, "concepts" | "images">;
}): LogoVersionSet {
  const createdAt = new Date().toISOString();
  const setId = createUuid();

  const concepts: LogoConcept[] = Array.isArray(opts.apiLogos.concepts) ? opts.apiLogos.concepts : [];
  const images: LogoImage[] = Array.isArray(opts.apiLogos.images) ? opts.apiLogos.images : [];

  const items: LogoItem[] = concepts.map((concept) => {
    const image = findImageForConcept(images, concept.id);
    const prompt = coerceString(image?.prompt);
    const imageUrl = image?.imageUrl ?? null;
    const imageError = image?.imageError || concept.imageError || undefined;

    return {
      id: createUuid(),
      createdAt,
      sourceConceptId: concept.id,
      name: `Logo Concept ${concept.id}`,
      description: concept.description,
      styleNotes: concept.styleNotes,
      colorPalette: Array.isArray(concept.colorPalette) ? concept.colorPalette : [],
      prompt,
      imageUrl,
      imageError,
      favorite: false,
      edited: {},
    };
  });

  return {
    id: setId,
    createdAt,
    briefSnapshot: opts.briefSnapshot,
    items,
  };
}

/**
 * Toggle favorite flag for a single logo item across all version sets.
 * Returns a new versionSets array (immutable update).
 */
export function toggleFavorite(versionSets: LogoVersionSet[], logoId: string): LogoVersionSet[] {
  let changed = false;

  const next = versionSets.map((set) => {
    const idx = set.items.findIndex((it) => it.id === logoId);
    if (idx === -1) return set;

    const item = set.items[idx];
    const updated: LogoItem = {
      ...item,
      favorite: !item.favorite,
      edited: { ...item.edited, favorite: true },
    };

    changed = true;
    const items = set.items.slice();
    items[idx] = updated;
    return { ...set, items };
  });

  return changed ? next : versionSets;
}

/**
 * Rename a single logo item across all version sets.
 * Returns a new versionSets array (immutable update).
 */
export function renameLogo(
  versionSets: LogoVersionSet[],
  logoId: string,
  newName: string
): LogoVersionSet[] {
  const trimmed = newName.trim();
  if (!trimmed) return versionSets;

  let changed = false;

  const next = versionSets.map((set) => {
    const idx = set.items.findIndex((it) => it.id === logoId);
    if (idx === -1) return set;

    const item = set.items[idx];
    if (item.name === trimmed) return set;

    const updated: LogoItem = {
      ...item,
      name: trimmed,
      edited: { ...item.edited, name: true },
    };

    changed = true;
    const items = set.items.slice();
    items[idx] = updated;
    return { ...set, items };
  });

  return changed ? next : versionSets;
}

export type BulkSelectionAction =
  | { type: "toggle"; id: string }
  | { type: "select_all"; ids: string[] }
  | { type: "clear" }
  | { type: "set"; ids: string[] }
  | { type: "add"; ids: string[] }
  | { type: "remove"; ids: string[] };

/**
 * Pure helper for multi-select selection state (Tier 5B).
 * NOTE: This is intentionally UI-agnostic and does not mutate inputs.
 */
export function applyBulkSelection(
  selectedIds: Set<string> | string[],
  action: BulkSelectionAction
): Set<string> {
  const base = selectedIds instanceof Set ? new Set(selectedIds) : new Set(selectedIds);

  switch (action.type) {
    case "toggle": {
      if (base.has(action.id)) base.delete(action.id);
      else base.add(action.id);
      return base;
    }
    case "select_all": {
      return new Set(action.ids);
    }
    case "clear": {
      return new Set();
    }
    case "set": {
      return new Set(action.ids);
    }
    case "add": {
      for (const id of action.ids) base.add(id);
      return base;
    }
    case "remove": {
      for (const id of action.ids) base.delete(id);
      return base;
    }
    default: {
      return base;
    }
  }
}


