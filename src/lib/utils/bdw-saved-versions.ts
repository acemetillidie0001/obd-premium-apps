/**
 * localStorage utility for Business Description Writer saved versions
 * 
 * Stores versions under key: obd_bdw_saved_versions_v1
 */

export interface SavedVersion {
  id: string;
  createdAt: string; // ISO date string
  businessName: string;
  city: string;
  state: string;
  inputs: {
    businessName: string;
    businessType: string;
    services: string;
    city: string;
    state: string;
    targetAudience: string;
    uniqueSellingPoints: string;
    keywords: string;
    brandVoice: string;
    personalityStyle?: string;
    writingStyleTemplate: string;
    includeFAQSuggestions: boolean;
    includeMetaDescription: boolean;
    descriptionLength: string;
    language: string;
  };
  outputs: {
    obdListingDescription: string; // short
    googleBusinessDescription: string; // medium
    websiteAboutUs: string; // long
    metaDescription: string | null;
  };
}

const STORAGE_KEY = "obd_bdw_saved_versions_v1";

/**
 * Get all saved versions from localStorage
 */
export function getSavedVersions(): SavedVersion[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error reading saved versions:", error);
    return [];
  }
}

/**
 * Save a new version to localStorage
 */
export function saveVersion(version: Omit<SavedVersion, "id" | "createdAt">): SavedVersion {
  const versions = getSavedVersions();
  const newVersion: SavedVersion = {
    ...version,
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  
  versions.unshift(newVersion); // Add to beginning (newest first)
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
    return newVersion;
  } catch (error) {
    console.error("Error saving version:", error);
    throw error;
  }
}

/**
 * Delete a version by ID
 */
export function deleteVersion(id: string): boolean {
  const versions = getSavedVersions();
  const filtered = versions.filter((v) => v.id !== id);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error("Error deleting version:", error);
    return false;
  }
}

/**
 * Export all versions as JSON string
 */
export function exportVersions(): string {
  const versions = getSavedVersions();
  return JSON.stringify(versions, null, 2);
}

/**
 * Import versions from JSON string
 */
export function importVersions(jsonString: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      return { success: false, count: 0, error: "Invalid format: expected array" };
    }
    
    // Validate structure
    const validVersions = parsed.filter((v) => 
      v.id && v.createdAt && v.businessName && v.inputs && v.outputs
    );
    
    if (validVersions.length === 0) {
      return { success: false, count: 0, error: "No valid versions found" };
    }
    
    // Merge with existing (avoid duplicates by ID)
    const existing = getSavedVersions();
    const existingIds = new Set(existing.map((v) => v.id));
    const newVersions = validVersions.filter((v) => !existingIds.has(v.id));
    
    const merged = [...newVersions, ...existing];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    
    return { success: true, count: newVersions.length };
  } catch (error) {
    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : "Invalid JSON" 
    };
  }
}

