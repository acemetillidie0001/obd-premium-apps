/**
 * Brand Profile LocalStorage Helpers
 * 
 * Standardized client-side storage helpers for brand profile data.
 * Uses business-scoped storage keys: `obd.brandProfile.v1.${businessId}`
 * Falls back to legacy unscoped key when businessId is unavailable.
 * 
 * Note: This is a client-side cache layer. The source of truth is the API.
 * These helpers can be used to cache API responses for offline access or faster loading.
 */

import { BrandProfile } from "./brand-profile-types";

const LEGACY_STORAGE_KEY = "obd.brandProfile.v1";

/**
 * Gets the storage key for a given businessId.
 * Returns scoped key if businessId is provided, otherwise returns legacy key.
 */
function getStorageKey(businessId?: string): string {
  if (businessId) {
    return `obd.brandProfile.v1.${businessId}`;
  }
  return LEGACY_STORAGE_KEY;
}

/**
 * Migrates a legacy unscoped profile to a scoped key when businessId becomes available.
 * This is called automatically when saving with a businessId.
 */
function migrateLegacyToScoped(businessId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const legacyData = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyData) {
      const scopedKey = getStorageKey(businessId);
      // Copy legacy data to scoped key
      window.localStorage.setItem(scopedKey, legacyData);
      // Optionally remove legacy key (keeping it for backward compatibility during migration)
      // window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch (error) {
    console.error("[brandProfileStorage] Failed to migrate legacy profile:", error);
  }
}

/**
 * Loads brand profile from localStorage.
 * 
 * @param businessId - Optional business ID to scope the storage key. If provided, uses scoped key.
 *                     If not provided, falls back to legacy unscoped key.
 * @returns Brand profile if found and valid, null otherwise
 * 
 * @example
 * const profile = loadBrandProfile("business-123");
 * if (profile) {
 *   console.log("Found cached profile:", profile.businessName);
 * }
 */
export function loadBrandProfile(businessId?: string): BrandProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    // Try scoped key first if businessId is provided
    if (businessId) {
      const scopedKey = getStorageKey(businessId);
      const stored = window.localStorage.getItem(scopedKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as BrandProfile;
          return parsed;
        } catch (error) {
          console.error("[brandProfileStorage] Failed to parse stored brand profile:", error);
          // Clear invalid data
          try {
            window.localStorage.removeItem(scopedKey);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }

    // Fallback to legacy unscoped key
    const stored = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    try {
      const parsed = JSON.parse(stored) as BrandProfile;
      // If we have a businessId and found legacy data, migrate it
      if (businessId) {
        migrateLegacyToScoped(businessId);
      }
      return parsed;
    } catch (error) {
      console.error("[brandProfileStorage] Failed to parse stored brand profile:", error);
      // Clear invalid data
      try {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // Ignore cleanup errors
      }
      return null;
    }
  } catch (error) {
    console.error("[brandProfileStorage] Failed to load brand profile:", error);
    return null;
  }
}

/**
 * Saves brand profile to localStorage.
 * 
 * @param profile - Brand profile to save
 * @param businessId - Optional business ID to scope the storage key. If provided, uses scoped key.
 *                     If not provided, falls back to legacy unscoped key.
 * 
 * @example
 * const profile = { businessName: "Acme Corp", brandVoice: "friendly" };
 * saveBrandProfile(profile, "business-123");
 */
export function saveBrandProfile(profile: BrandProfile, businessId?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storageKey = getStorageKey(businessId);
    const serialized = JSON.stringify(profile);
    window.localStorage.setItem(storageKey, serialized);

    // Migrate legacy data if we have a businessId
    if (businessId) {
      migrateLegacyToScoped(businessId);
    }
  } catch (error) {
    console.error("[brandProfileStorage] Failed to save brand profile:", error);
    // Storage quota exceeded or other error - silently fail
  }
}

/**
 * Deletes brand profile from localStorage.
 * 
 * @param businessId - Optional business ID to scope the storage key. If provided, deletes scoped key.
 *                     If not provided, deletes legacy unscoped key.
 * 
 * @example
 * deleteBrandProfile("business-123");
 */
export function deleteBrandProfile(businessId?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storageKey = getStorageKey(businessId);
    window.localStorage.removeItem(storageKey);
  } catch (error) {
    console.error("[brandProfileStorage] Failed to delete brand profile:", error);
  }
}

/**
 * Checks if a brand profile exists in localStorage.
 * 
 * @param businessId - Optional business ID to scope the storage key. If provided, checks scoped key.
 *                     If not provided, checks legacy unscoped key.
 * @returns true if a brand profile exists, false otherwise
 * 
 * @example
 * if (hasBrandProfile("business-123")) {
 *   console.log("Brand profile is cached");
 * }
 */
export function hasBrandProfile(businessId?: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const storageKey = getStorageKey(businessId);
    const stored = window.localStorage.getItem(storageKey);
    
    // If checking scoped key and not found, also check legacy key
    if (businessId && !stored) {
      const legacyStored = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      return legacyStored !== null && legacyStored !== "";
    }
    
    return stored !== null && stored !== "";
  } catch {
    return false;
  }
}

