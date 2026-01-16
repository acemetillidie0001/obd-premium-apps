import type { LocalKeywordResponse } from "@/app/api/local-keyword-research/types";

/**
 * Canonical LKRT Results Selector (Tier 5A)
 *
 * Single source of truth for which keyword results the UI should display.
 *
 * Rules:
 * - If edited results exist → return edited
 * - Else if generated results exist → return generated
 * - Never recompute
 * - Never mutate source data
 */
export function getActiveKeywordResults(
  generated: LocalKeywordResponse | null,
  edited: LocalKeywordResponse | null
): LocalKeywordResponse | null {
  return edited ?? generated;
}


