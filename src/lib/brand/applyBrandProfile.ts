/**
 * Brand Profile Application Engine
 * 
 * Applies brand profile data to form objects with configurable merge strategies.
 * Framework-agnostic utility for merging brand profile data into any form structure.
 */

import { BrandProfile } from "./brand-profile-types";

export type MergeMode = "fill-empty-only" | "overwrite";

export type FieldMapper<T> = 
  | Record<string, keyof BrandProfile>
  | ((formKey: keyof T, brand: BrandProfile) => keyof BrandProfile | undefined);

export interface ApplyBrandProfileArgs<T> {
  form: T;
  brand: BrandProfile;
  map: FieldMapper<T>;
  mode?: MergeMode;
}

/**
 * Checks if a value is considered "empty" for merge purposes.
 * Empty means: undefined, null, empty string, or only whitespace.
 */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (typeof value === "boolean") {
    return false; // Booleans are never "empty"
  }
  return false;
}

/**
 * Checks if a brand profile value is non-empty and should be applied.
 */
function hasBrandValue(brandValue: unknown): boolean {
  if (brandValue === undefined || brandValue === null) return false;
  if (typeof brandValue === "string") {
    return brandValue.trim() !== "";
  }
  if (typeof brandValue === "boolean") {
    return true; // Booleans are always considered "has value"
  }
  return true;
}

/**
 * Gets the brand profile field name for a form field.
 */
function getBrandField<T>(
  formKey: keyof T,
  map: FieldMapper<T>,
  brand: BrandProfile
): keyof BrandProfile | undefined {
  if (typeof map === "function") {
    return map(formKey, brand);
  }
  // Record mapper
  const formKeyStr = String(formKey);
  return map[formKeyStr] as keyof BrandProfile | undefined;
}

/**
 * Applies brand profile data to a form object.
 * 
 * @param args - Configuration object
 * @param args.form - The form object to merge brand data into
 * @param args.brand - The brand profile to apply
 * @param args.map - Field mapping (Record or callback function)
 * @param args.mode - Merge mode: "fill-empty-only" (default) or "overwrite"
 * @returns New merged form object (original form is not mutated)
 * 
 * @example
 * // Using Record mapper
 * const merged = applyBrandProfileToForm({
 *   form: { businessName: "", brandVoice: "existing" },
 *   brand: { businessName: "Acme Corp", brandVoice: "friendly" },
 *   map: { businessName: "businessName", brandVoice: "brandVoice" },
 *   mode: "fill-empty-only"
 * });
 * // Result: { businessName: "Acme Corp", brandVoice: "existing" }
 * 
 * @example
 * // Using callback mapper
 * const merged = applyBrandProfileToForm({
 *   form: { companyName: "" },
 *   brand: { businessName: "Acme Corp" },
 *   map: (formKey) => {
 *     if (formKey === "companyName") return "businessName";
 *     return undefined;
 *   }
 * });
 */
export function applyBrandProfileToForm<T extends Record<string, unknown>>(
  args: ApplyBrandProfileArgs<T>
): T {
  const { form, brand, map, mode = "fill-empty-only" } = args;

  // Create a shallow copy to avoid mutating the original
  const merged = { ...form };

  // Iterate over form keys and apply brand values
  for (const formKey in form) {
    if (!Object.prototype.hasOwnProperty.call(form, formKey)) continue;

    const brandField = getBrandField(formKey, map, brand);
    if (!brandField) continue; // No mapping for this field

    const formValue = form[formKey];
    const brandValue = brand[brandField];

    // Skip if brand doesn't have a value for this field
    if (!hasBrandValue(brandValue)) continue;

    // Apply based on mode
    if (mode === "fill-empty-only") {
      // Only fill if form field is empty
      if (isEmpty(formValue)) {
        merged[formKey] = brandValue as T[typeof formKey];
      }
    } else if (mode === "overwrite") {
      // Always overwrite with brand value
      merged[formKey] = brandValue as T[typeof formKey];
    }
  }

  return merged;
}

/* ============================================================================
 * INLINE UNIT-LIKE TESTS (commented examples)
 * ============================================================================
 * 
 * These are example test cases that demonstrate the expected behavior.
 * They can be used as reference or converted to actual unit tests.
 */

/*
// Test 1: fill-empty-only mode - should only fill empty fields
const test1 = applyBrandProfileToForm({
  form: { businessName: "", brandVoice: "existing voice" },
  brand: { businessName: "Acme Corp", brandVoice: "friendly" },
  map: { businessName: "businessName", brandVoice: "brandVoice" },
  mode: "fill-empty-only"
});
// Expected: { businessName: "Acme Corp", brandVoice: "existing voice" }

// Test 2: overwrite mode - should overwrite all fields
const test2 = applyBrandProfileToForm({
  form: { businessName: "Old Name", brandVoice: "old voice" },
  brand: { businessName: "New Corp", brandVoice: "new voice" },
  map: { businessName: "businessName", brandVoice: "brandVoice" },
  mode: "overwrite"
});
// Expected: { businessName: "New Corp", brandVoice: "new voice" }

// Test 3: whitespace-only strings should be treated as empty
const test3 = applyBrandProfileToForm({
  form: { businessName: "   ", city: null },
  brand: { businessName: "Acme", city: "Ocala" },
  map: { businessName: "businessName", city: "city" },
  mode: "fill-empty-only"
});
// Expected: { businessName: "Acme", city: "Ocala" }

// Test 4: callback mapper - custom field mapping
const test4 = applyBrandProfileToForm({
  form: { companyName: "", location: "" },
  brand: { businessName: "Acme", city: "Ocala" },
  map: (formKey) => {
    if (formKey === "companyName") return "businessName";
    if (formKey === "location") return "city";
    return undefined;
  }
});
// Expected: { companyName: "Acme", location: "Ocala" }

// Test 5: boolean values should be applied even if false
const test5 = applyBrandProfileToForm({
  form: { includeHashtags: undefined },
  brand: { includeHashtags: false },
  map: { includeHashtags: "includeHashtags" },
  mode: "fill-empty-only"
});
// Expected: { includeHashtags: false }

// Test 6: brand value is empty string - should not apply
const test6 = applyBrandProfileToForm({
  form: { businessName: "" },
  brand: { businessName: "" },
  map: { businessName: "businessName" },
  mode: "fill-empty-only"
});
// Expected: { businessName: "" } (no change)

// Test 7: no mapping for field - should be ignored
const test7 = applyBrandProfileToForm({
  form: { businessName: "", otherField: "keep" },
  brand: { businessName: "Acme" },
  map: { businessName: "businessName" },
  mode: "overwrite"
});
// Expected: { businessName: "Acme", otherField: "keep" }

// Test 8: nested object structure preserved
const test8 = applyBrandProfileToForm({
  form: { 
    info: { name: "", type: "existing" },
    voice: ""
  },
  brand: { businessName: "Acme", brandVoice: "friendly" },
  map: (formKey) => {
    if (formKey === "info") return undefined; // No mapping for nested
    if (formKey === "voice") return "brandVoice";
    return undefined;
  }
});
// Expected: { info: { name: "", type: "existing" }, voice: "friendly" }
*/

