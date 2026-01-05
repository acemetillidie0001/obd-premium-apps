/**
 * Knowledge Coverage Helper
 * Pure functions for computing knowledge base coverage status
 */

import type { KnowledgeEntry } from "../components/KnowledgeList";

export type CoverageStatus = "Strong" | "Partial" | "Needs improvement" | "Unknown";

export interface CoverageResult {
  status: CoverageStatus;
  entryCount: number;
  typeCount: number;
}

/**
 * Compute knowledge coverage status from entries
 */
export function computeCoverage(entries: KnowledgeEntry[] | null | undefined): CoverageResult {
  // If no entries provided, return Unknown
  if (!entries || entries.length === 0) {
    return {
      status: "Unknown",
      entryCount: 0,
      typeCount: 0,
    };
  }

  const entryCount = entries.length;
  
  // Count unique types
  const uniqueTypes = new Set(entries.map((entry) => entry.type));
  const typeCount = uniqueTypes.size;

  // Classification rules:
  // - Strong: entries >= 15 AND at least 2 types
  // - Partial: entries between 5-14 OR only 1 type
  // - Needs improvement: entries < 5
  let status: CoverageStatus;
  if (entryCount >= 15 && typeCount >= 2) {
    status = "Strong";
  } else if (entryCount >= 5 && entryCount <= 14) {
    status = "Partial";
  } else if (typeCount === 1 && entryCount >= 5) {
    status = "Partial";
  } else if (entryCount < 5) {
    status = "Needs improvement";
  } else {
    // Fallback (shouldn't happen with current logic)
    status = "Partial";
  }

  return {
    status,
    entryCount,
    typeCount,
  };
}

