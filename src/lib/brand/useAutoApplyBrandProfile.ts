/**
 * React Hook for Auto-Applying Brand Profile
 * 
 * Automatically loads and applies brand profile data to form state.
 * Runs once per page load (or per session, configurable).
 * Framework-agnostic React hook (no Next.js dependencies).
 */

import { useEffect, useRef, useState } from "react";
import { BrandProfile } from "./brand-profile-types";
import { applyBrandProfileToForm, FieldMapper, MergeMode } from "./applyBrandProfile";
import { loadBrandProfile as loadBrandProfileFromStorage, saveBrandProfile } from "./brandProfileStorage";

export interface UseAutoApplyBrandProfileArgs<T> {
  /** Whether auto-apply is enabled */
  enabled?: boolean;
  /** Current form state */
  form: T;
  /** Form state setter function */
  setForm: (form: T | ((prev: T) => T)) => void;
  /** Field mapping (Record or callback) */
  map: FieldMapper<T>;
  /** Storage key for tracking if auto-apply has run (prevents duplicate runs) */
  storageKey: string;
  /** Merge mode: "fill-empty-only" (default) or "overwrite" */
  fillEmptyOnly?: boolean;
  /** When to run: "per-page-load" (default) or "per-session" */
  once?: "per-page-load" | "per-session";
  /** Optional business ID to scope the storage key. If provided, uses scoped key. */
  businessId?: string;
}

export interface UseAutoApplyBrandProfileResult {
  /** Whether brand profile was successfully applied */
  applied: boolean;
  /** Whether a brand profile was found and loaded */
  brandFound: boolean;
}

/**
 * Loads brand profile from localStorage cache, with API fallback.
 * Caches API response in localStorage for future use.
 * 
 * @param businessId - Optional business ID to scope the storage key
 */
async function loadBrandProfile(businessId?: string): Promise<BrandProfile | null> {
  // Try localStorage first (fast, cached)
  const cached = loadBrandProfileFromStorage(businessId);
  if (cached) {
    return cached;
  }

  // Fall back to API if not in cache
  try {
    const res = await fetch("/api/brand-profile");
    if (res.ok) {
      const profile = await res.json();
      if (profile) {
        // Extract businessId from API response if available
        // The API response may contain businessId in the profile object
        // For now, use the provided businessId or extract from profile if available
        const resolvedBusinessId = businessId || (profile as { businessId?: string }).businessId;
        
        // Cache the API response for future use using scoped key if businessId is available
        saveBrandProfile(profile, resolvedBusinessId);
        return profile;
      }
    }
    return null;
  } catch (error) {
    console.error("[useAutoApplyBrandProfile] Failed to load brand profile:", error);
    return null;
  }
}

/**
 * Checks if auto-apply has already run for this storage key.
 */
function hasAutoApplied(storageKey: string, once: "per-page-load" | "per-session"): boolean {
  if (typeof window === "undefined") return false;

  try {
    const key = `brand-auto-apply:${storageKey}`;
    
    if (once === "per-page-load") {
      // Use a ref-like approach via sessionStorage (cleared on page reload)
      // We'll use a ref in the hook, but this is a fallback check
      return sessionStorage.getItem(key) === "true";
    } else {
      // Per-session: use sessionStorage (cleared when browser tab closes)
      return sessionStorage.getItem(key) === "true";
    }
  } catch {
    return false;
  }
}

/**
 * Marks auto-apply as completed for this storage key.
 */
function markAutoApplied(storageKey: string, once: "per-page-load" | "per-session"): void {
  if (typeof window === "undefined") return;

  try {
    const key = `brand-auto-apply:${storageKey}`;
    sessionStorage.setItem(key, "true");
  } catch {
    // Ignore storage errors
  }
}

/**
 * React hook that automatically loads and applies brand profile to form state.
 * 
 * @param args - Configuration object
 * @returns Object with `applied` and `brandFound` flags
 * 
 * @example
 * // Basic usage with Record mapper
 * const { applied, brandFound } = useAutoApplyBrandProfile({
 *   enabled: true,
 *   form: formValues,
 *   setForm: setFormValues,
 *   map: {
 *     businessName: "businessName",
 *     brandVoice: "brandVoice",
 *     city: "city"
 *   },
 *   storageKey: "content-writer-page"
 * });
 * 
 * @example
 * // With callback mapper and custom options
 * const { applied } = useAutoApplyBrandProfile({
 *   enabled: shouldUseBrandProfile,
 *   form: formState,
 *   setForm: setFormState,
 *   map: (formKey) => {
 *     if (formKey === "companyName") return "businessName";
 *     if (formKey === "location") return "city";
 *     return undefined;
 *   },
 *   storageKey: "my-app-page",
 *   fillEmptyOnly: true,
 *   once: "per-session"
 * });
 */
export function useAutoApplyBrandProfile<T extends Record<string, unknown>>(
  args: UseAutoApplyBrandProfileArgs<T>
): UseAutoApplyBrandProfileResult {
  const {
    enabled = true,
    form,
    setForm,
    map,
    storageKey,
    fillEmptyOnly = true,
    once = "per-page-load",
    businessId,
  } = args;

  const [applied, setApplied] = useState(false);
  const [brandFound, setBrandFound] = useState(false);
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Early exits
    if (!enabled) return;
    if (hasRunRef.current) return;
    if (hasAutoApplied(storageKey, once)) {
      hasRunRef.current = true;
      return;
    }

    // Mark as running immediately to prevent duplicate calls
    hasRunRef.current = true;

    // Load and apply brand profile
    loadBrandProfile(businessId)
      .then((brand) => {
        if (!brand) {
          setBrandFound(false);
          setApplied(false);
          return;
        }

        setBrandFound(true);

        // Apply brand profile to form
        const mode: MergeMode = fillEmptyOnly ? "fill-empty-only" : "overwrite";
        const merged = applyBrandProfileToForm({
          form,
          brand,
          map,
          mode,
        });

        // Update form state
        setForm(merged);
        setApplied(true);

        // Mark as completed
        markAutoApplied(storageKey, once);
      })
      .catch((error) => {
        console.error("[useAutoApplyBrandProfile] Error applying brand profile:", error);
        setBrandFound(false);
        setApplied(false);
      });
  }, [enabled, form, setForm, map, storageKey, fillEmptyOnly, once, businessId]);

  return { applied, brandFound };
}

