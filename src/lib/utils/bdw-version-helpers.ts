/**
 * Helper utilities for BDW versions
 */

import { type SavedVersion } from "./bdw-saved-versions";

/**
 * Generate a destination summary string (e.g., "GBP+Meta", "OBD+Website+Meta")
 */
export function getDestinationSummary(version: SavedVersion): string {
  const parts: string[] = [];

  if (version.outputs.obdListingDescription) {
    parts.push("OBD");
  }
  if (version.outputs.googleBusinessDescription) {
    parts.push("GBP");
  }
  if (version.outputs.websiteAboutUs) {
    parts.push("Website");
  }
  if (version.outputs.metaDescription) {
    parts.push("Meta");
  }

  return parts.length > 0 ? parts.join("+") : "None";
}

/**
 * Duplicate a version (creates a new version with same data but new ID and timestamp)
 */
export function duplicateVersion(version: SavedVersion): Omit<SavedVersion, "id" | "createdAt"> {
  return {
    businessName: version.businessName,
    city: version.city,
    state: version.state,
    inputs: { ...version.inputs },
    outputs: { ...version.outputs },
  };
}

