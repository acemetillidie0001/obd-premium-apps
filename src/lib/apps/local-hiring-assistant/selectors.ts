import type { JobPostItem, JobPostSection, JobPostSectionKey } from "./types";

export function getSectionContent(section: JobPostSection): string {
  return section.edited ?? section.generated;
}

/**
 * Stable stringify for deterministic hashing. Assumes JSON-serializable inputs.
 * - Object keys are sorted
 * - Arrays preserve order
 */
export function stableStringify(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number" || t === "boolean") return JSON.stringify(value);
  if (t === "undefined") return "null";
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  // functions/symbols/etc aren't expected; fall back to JSON.stringify behavior
  return JSON.stringify(value);
}

/**
 * FNV-1a 32-bit hash (fast + stable). Good enough for deterministic IDs/hashes.
 */
const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

function fnv1a32(str: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

function hex8(n: number): string {
  return n.toString(16).toUpperCase().padStart(8, "0");
}

export function createInputsHash(inputsJson: string): string {
  return hex8(fnv1a32(inputsJson));
}

export function createJobPostItemId(params: {
  createdAtIso: string;
  inputsHash: string;
}): string {
  const seed = `${params.createdAtIso}::${params.inputsHash}`;
  return `LHA-${hex8(fnv1a32(seed))}`;
}

export function normalizeSections(sections: JobPostSection[]): JobPostSection[] {
  const byKey = new Map<JobPostSection["key"], JobPostSection>();
  for (const s of sections ?? []) {
    if (!s) continue;
    if (!byKey.has(s.key)) byKey.set(s.key, s);
  }
  // Ensure stable order matching JOB_POST_SECTIONS.
  // NOTE: We avoid importing JOB_POST_SECTIONS here to keep this file dependency-light.
  const order: JobPostSection["key"][] = ["full", "summary", "indeed", "careersPage", "social"];
  return order
    .map((k) => byKey.get(k))
    .filter((s): s is JobPostSection => !!s);
}

export function createJobPostItem(params: {
  createdAtIso?: string;
  inputs: unknown;
  generatedByKey: Partial<Record<JobPostSectionKey, string>>;
}): JobPostItem {
  const createdAtIso = params.createdAtIso ?? new Date().toISOString();
  const inputsJson = stableStringify(params.inputs);
  const inputsHash = createInputsHash(inputsJson);
  const id = createJobPostItemId({ createdAtIso, inputsHash });

  const order: JobPostSectionKey[] = ["full", "summary", "indeed", "careersPage", "social"];
  const sections: JobPostSection[] = order.map((key) => {
    const title =
      key === "full"
        ? "Full Job Post"
        : key === "summary"
          ? "Summary"
          : key === "indeed"
            ? "Indeed"
            : key === "careersPage"
              ? "Careers Page"
              : "Social";
    return {
      key,
      title,
      generated: (params.generatedByKey[key] ?? "") || "",
      edited: null,
    };
  });

  return {
    id,
    createdAt: createdAtIso,
    updatedAt: createdAtIso,
    inputsHash,
    inputsJson,
    sections,
  };
}

export function canExportJobPost(
  item: JobPostItem | null,
  requiredKeys: JobPostSection["key"][] = [],
): { ok: boolean; reason?: string } {
  if (!item) return { ok: false, reason: "Nothing to export yet." };

  const sections = normalizeSections(item.sections ?? []);

  const seen = new Set<JobPostSection["key"]>();
  for (const s of item.sections ?? []) {
    if (seen.has(s.key)) {
      return { ok: false, reason: `Export data is corrupted (duplicate section: ${s.key}).` };
    }
    seen.add(s.key);
  }

  for (const key of requiredKeys) {
    const section = sections.find((s) => s.key === key);
    const text = section ? getSectionContent(section).trim() : "";
    if (!text) return { ok: false, reason: `Missing required export section: ${key}.` };
  }

  const anyNonEmpty = sections.some((s) => getSectionContent(s).trim().length > 0);

  if (!anyNonEmpty) {
    return { ok: false, reason: "Nothing to export yet." };
  }

  return { ok: true };
}

export function getJobPostStatus(item: JobPostItem): "Draft" | "Generated" | "Edited" {
  const sections = item.sections ?? [];

  const anyGeneratedNonEmpty = sections.some(
    (s) => (s.generated ?? "").trim().length > 0,
  );

  const allGeneratedEmpty = !anyGeneratedNonEmpty;

  const anyEditedNonEmptyDifferentFromGenerated = sections.some((s) => {
    const edited = s.edited;
    if (edited === undefined || edited === null) return false;
    if (edited.trim().length === 0) return false;
    return edited !== (s.generated ?? "");
  });

  if (allGeneratedEmpty) return "Draft";
  if (anyEditedNonEmptyDifferentFromGenerated) return "Edited";
  return "Generated";
}

function parseTime(value: string): number {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

export function getActiveJobPost(
  items: JobPostItem[],
  activeId?: string | null,
): JobPostItem | null {
  const sorted = getActiveJobPosts(items);
  if (sorted.length === 0) return null;
  if (activeId) {
    const match = sorted.find((p) => p.id === activeId);
    if (match) return match;
  }
  return sorted[0] ?? null;
}

export function getActiveJobPosts(items: JobPostItem[]): JobPostItem[] {
  return [...(items ?? [])].sort((a, b) => {
    const bt = parseTime(b.updatedAt);
    const at = parseTime(a.updatedAt);
    if (bt !== at) return bt - at;
    return a.id.localeCompare(b.id);
  });
}


