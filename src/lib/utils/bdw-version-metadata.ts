/**
 * Version metadata utilities for Business Description Writer
 * Stores rename/tags metadata in localStorage (not in DB schema)
 */

export interface VersionMetadata {
  rename?: string;
  tags?: string; // Comma-separated tags
}

const STORAGE_PREFIX = "bdw-version-metadata-";

/**
 * Get storage key for a version ID
 */
function getStorageKey(versionId: string): string {
  return `${STORAGE_PREFIX}${versionId}`;
}

/**
 * Save metadata for a version
 */
export function saveVersionMetadata(versionId: string, metadata: VersionMetadata): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }

    const key = getStorageKey(versionId);
    const serialized = JSON.stringify(metadata);
    window.localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error("Failed to save version metadata:", error);
    return false;
  }
}

/**
 * Load metadata for a version
 */
export function loadVersionMetadata(versionId: string): VersionMetadata | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }

    const key = getStorageKey(versionId);
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as VersionMetadata;
    // Validate structure
    if (
      (parsed.rename === undefined || typeof parsed.rename === "string") &&
      (parsed.tags === undefined || typeof parsed.tags === "string")
    ) {
      return parsed;
    }

    return null;
  } catch (error) {
    console.error("Failed to load version metadata:", error);
    return null;
  }
}

/**
 * Delete metadata for a version
 */
export function deleteVersionMetadata(versionId: string): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }

    const key = getStorageKey(versionId);
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("Failed to delete version metadata:", error);
    return false;
  }
}

