/**
 * Local Hiring Assistant — Tier 5B canonical job post export model.
 *
 * This model is intentionally UI-friendly and export-oriented. It represents the
 * deterministic, canonical "export pack" for a single generation, with optional edits
 * per section.
 */

export type JobPostSectionKey =
  | "full"
  | "summary"
  | "indeed"
  | "careersPage"
  | "social";

export type JobPostSection = {
  key: JobPostSectionKey;
  title: string;
  generated: string;
  edited?: string | null;
  updatedAt?: string;
};

export type JobPostItem = {
  /**
   * Deterministic ID (Tier 5B) derived from inputsHash + createdAt.
   * (Previously random UUIDs were used in the UI.)
   */
  id: string;

  /** ISO timestamps to keep this model storage-friendly (localStorage, JSON). */
  createdAt: string;
  updatedAt: string;

  /**
   * Deterministic hash of the inputs snapshot (not the raw JSON itself).
   * Use `inputsJson` for human debugging/labeling.
   */
  inputsHash: string;

  /**
   * Stable JSON snapshot (sorted keys) for labeling/debugging.
   * Optional for backwards compatibility with older saved items.
   */
  inputsJson?: string;

  sections: JobPostSection[];
};

export const JOB_POST_SECTIONS: ReadonlyArray<{
  key: JobPostSectionKey;
  title: string;
}> = [
  { key: "full", title: "Full Job Post" },
  { key: "summary", title: "Summary" },
  { key: "indeed", title: "Indeed" },
  { key: "careersPage", title: "Careers Page" },
  { key: "social", title: "Social" },
] as const;

