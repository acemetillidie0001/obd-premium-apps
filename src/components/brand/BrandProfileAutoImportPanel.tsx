/**
 * Standardized Brand Profile Auto-Import Panel
 * 
 * Shared UI component for Brand Profile auto-import functionality across all apps.
 * Provides toggle, manual apply, and clear functionality with consistent behavior.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import OBDPanel from "@/components/obd/OBDPanel";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { useAutoApplyBrandProfile } from "@/lib/brand/useAutoApplyBrandProfile";
import { hasBrandProfile, loadBrandProfile } from "@/lib/brand/brandProfileStorage";
import { type BrandProfile as BrandProfileType } from "@/lib/brand/brand-profile-types";
import { applyBrandProfileToForm, type FieldMapper } from "@/lib/brand/applyBrandProfile";

export interface BrandProfileAutoImportPanelProps<T> {
  /** Whether dark mode is enabled */
  isDark: boolean;
  /** Current form state */
  form: T;
  /** Form state setter */
  setForm: (form: T | ((prev: T) => T)) => void;
  /** Field mapping between form and brand profile */
  map: FieldMapper<T>;
  /** Storage key for tracking auto-apply execution */
  storageKey: string;
  /** Optional callback when brand profile is applied */
  onApplied?: () => void;
  /** Optional callback to show toast notification */
  onToast?: (message: string) => void;
}

/**
 * Standardized Brand Profile Auto-Import Panel
 * 
 * Provides:
 * - Toggle: "Use Brand Profile (auto-fill empty fields)"
 * - Checkbox: "Fill empty only" (default ON)
 * - Button: "Apply to form" (manual apply)
 * - Button: "Clear brand fields"
 * - Link: "Edit Brand Profile" -> /apps/brand-profile
 */
export default function BrandProfileAutoImportPanel<T extends Record<string, unknown>>({
  isDark,
  form,
  setForm,
  map,
  storageKey,
  onApplied,
  onToast,
}: BrandProfileAutoImportPanelProps<T>) {
  const themeClasses = getThemeClasses(isDark);
  const [useBrandProfile, setUseBrandProfile] = useState(() => {
    if (typeof window === "undefined") return true;
    return hasBrandProfile();
  });
  const [fillEmptyOnly, setFillEmptyOnly] = useState(true);
  const [brandProfileExists, setBrandProfileExists] = useState(false);

  // Check if brand profile exists
  useEffect(() => {
    setBrandProfileExists(hasBrandProfile());
  }, []);

  // Auto-apply brand profile to form
  const { applied: brandProfileApplied, brandFound } = useAutoApplyBrandProfile({
    enabled: useBrandProfile,
    form: form as unknown as Record<string, unknown>,
    setForm: (formOrUpdater) => {
      if (typeof formOrUpdater === "function") {
        setForm((prev) => formOrUpdater(prev as unknown as Record<string, unknown>) as unknown as T);
      } else {
        setForm(formOrUpdater as unknown as T);
      }
    },
    map: map as (formKey: string, brand: BrandProfileType) => keyof BrandProfileType | undefined,
    storageKey,
    once: "per-page-load",
    fillEmptyOnly: true, // Auto-import always uses fill-empty-only
  });

  // Show toast when auto-applied
  useEffect(() => {
    if (brandProfileApplied && brandFound && onToast) {
      onToast("Brand Profile applied to empty fields.");
    }
    if (brandProfileApplied && onApplied) {
      onApplied();
    }
  }, [brandProfileApplied, brandFound, onToast, onApplied]);

  // Manual apply handler
  const handleManualApply = () => {
    const profile = loadBrandProfile();
    if (!profile) {
      if (onToast) {
        onToast("No brand profile found. Please create one first.");
      }
      return;
    }

    const mode = fillEmptyOnly ? "fill-empty-only" : "overwrite";
    const merged = applyBrandProfileToForm({
      form: form as unknown as Record<string, unknown>,
      brand: profile,
      map: map as FieldMapper<Record<string, unknown>>,
      mode,
    });

    setForm(merged as unknown as T);

    if (onToast) {
      onToast(
        mode === "fill-empty-only"
          ? "Brand Profile applied to empty fields."
          : "Brand Profile applied (overwrote existing fields)."
      );
    }
    if (onApplied) {
      onApplied();
    }
  };

  // Clear brand fields handler
  const handleClearBrandFields = () => {
    if (!confirm("Clear all brand-related fields from the form? This cannot be undone.")) {
      return;
    }

    const profile = loadBrandProfile();
    if (!profile) {
      if (onToast) {
        onToast("No brand profile found.");
      }
      return;
    }

    // Get all brand profile field names
    const brandFields = new Set<keyof BrandProfileType>();
    if (typeof map === "function") {
      // For callback mapper, we need to check all form keys
      Object.keys(form).forEach((formKey) => {
        const brandField = map(formKey as keyof T, profile);
        if (brandField) {
          brandFields.add(brandField);
        }
      });
    } else {
      // For record mapper, get all mapped values
      Object.values(map).forEach((brandField) => {
        brandFields.add(brandField);
      });
    }

    // Clear form fields that map to brand profile fields
    const cleared: Partial<Record<string, unknown>> = {};
    if (typeof map === "function") {
      Object.keys(form).forEach((formKey) => {
        const brandField = map(formKey as keyof T, profile);
        if (brandField && profile[brandField] !== undefined && profile[brandField] !== null) {
          // Clear the form field if it matches a brand profile value
          const formValue = (form as Record<string, unknown>)[formKey];
          const brandValue = profile[brandField];
          if (formValue === brandValue || (typeof formValue === "string" && formValue.trim() === String(brandValue || "").trim())) {
            cleared[formKey] = typeof formValue === "string" ? "" : formValue === null ? null : undefined;
          }
        }
      });
    } else {
      Object.entries(map).forEach(([formKey, brandField]) => {
        const formValue = (form as Record<string, unknown>)[formKey];
        const brandValue = profile[brandField];
        if (formValue === brandValue || (typeof formValue === "string" && formValue.trim() === String(brandValue || "").trim())) {
          cleared[formKey] = typeof formValue === "string" ? "" : formValue === null ? null : undefined;
        }
      });
    }

    if (Object.keys(cleared).length > 0) {
      setForm((prev) => ({ ...prev, ...cleared } as T));
      if (onToast) {
        onToast("Brand fields cleared from form.");
      }
    } else {
      if (onToast) {
        onToast("No matching brand fields found to clear.");
      }
    }
  };

  return (
    <OBDPanel isDark={isDark} className="mt-7">
      <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <div className="p-4 space-y-4">
          {/* Toggle: Use Brand Profile */}
          <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <label className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}>
                <input
                  type="checkbox"
                  checked={useBrandProfile}
                  onChange={(e) => setUseBrandProfile(e.target.checked)}
                  className="rounded"
                  disabled={!brandProfileExists}
                />
                <span className="text-sm font-medium">
                  Use Brand Profile (auto-fill empty fields)
                </span>
              </label>
              {/* Status Indicator */}
              <div>
                {brandFound ? (
                  <>
                    <span className={`text-xs ${themeClasses.mutedText}`}>
                      Saved Brand Profile detected.
                    </span>
                    {brandProfileApplied && (
                      <div className={`text-xs ${themeClasses.mutedText} mt-0.5`}>
                        Applied to empty fields.
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href="/apps/brand-profile"
                    className={`text-xs ${themeClasses.mutedText} hover:underline`}
                  >
                    Create a Brand Profile →
                  </Link>
                )}
              </div>
            </div>
            <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
              {brandProfileExists
                ? "When enabled, your saved brand profile will automatically fill empty form fields on page load."
                : "No brand profile found. Create one to enable auto-fill."}
            </p>
          </div>

          {/* Manual Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Fill Empty Only Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fillEmptyOnly}
                onChange={(e) => setFillEmptyOnly(e.target.checked)}
                className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                disabled={!brandProfileExists}
              />
              <span className={`text-sm ${themeClasses.labelText}`}>Fill empty only</span>
            </label>

            {/* Apply to Form Button */}
            <button
              type="button"
              onClick={handleManualApply}
              disabled={!brandProfileExists}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                brandProfileExists
                  ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
              title={!brandProfileExists ? "No brand profile found. Create one first." : undefined}
            >
              Apply to form
            </button>

            {/* Clear Brand Fields Button */}
            <button
              type="button"
              onClick={handleClearBrandFields}
              disabled={!brandProfileExists}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                brandProfileExists
                  ? isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
              title={!brandProfileExists ? "No brand profile found." : undefined}
            >
              Clear brand fields
            </button>

            <div className="flex-1" />

            {/* Edit Brand Profile Link */}
            <Link
              href="/apps/brand-profile"
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Edit Brand Profile →
            </Link>
          </div>
        </div>
      </div>
    </OBDPanel>
  );
}

