/**
 * OBD Brand-Safe Image Generator - Constants
 * 
 * Platform defaults, category defaults, and deterministic configuration.
 */

import type { ImagePlatform, ImageAspect, ImageCategory, ImageEnergy, TextAllowance } from "./types";

// ============================================
// Platform Aspect Defaults
// ============================================

/**
 * Platform aspect ratio defaults.
 * For platforms with multiple options, we choose a stable default.
 */
export const PLATFORM_ASPECT_DEFAULTS: Record<ImagePlatform, ImageAspect> = {
  instagram: "4:5", // Default for posts (1:1 also supported but 4:5 is default)
  facebook: "4:5",
  x: "16:9",
  google_business_profile: "4:3",
  blog: "16:9",
};

/**
 * Alternative aspect ratios per platform (for future use).
 * Not used in Phase 1, but documented for Phase 2.
 */
export const PLATFORM_ASPECT_ALTERNATIVES: Partial<Record<ImagePlatform, ImageAspect[]>> = {
  instagram: ["1:1", "4:5"],
};

// ============================================
// Category Defaults
// ============================================

export interface CategoryDefaults {
  energy: ImageEnergy;
  textAllowance: TextAllowance;
}

/**
 * Category-based defaults for energy and text allowance.
 * Note: textAllowance may be overridden by allowTextOverlay in request,
 * but the default here is what we use if allowTextOverlay is false.
 */
export const CATEGORY_DEFAULTS: Record<ImageCategory, CategoryDefaults> = {
  educational: {
    energy: "medium",
    textAllowance: "minimal", // Default minimal, but becomes "none" if allowTextOverlay is false
  },
  promotion: {
    energy: "high",
    textAllowance: "headline_only", // Default headline_only, but becomes "none" if allowTextOverlay is false
  },
  social_proof: {
    energy: "medium",
    textAllowance: "none", // Never allow testimonial claims
  },
  local_abstract: {
    energy: "low",
    textAllowance: "none",
  },
  evergreen: {
    energy: "low",
    textAllowance: "minimal", // Default minimal, but becomes "none" if allowTextOverlay is false
  },
};

// ============================================
// Safety Configuration
// ============================================

/**
 * Default safe mode (always "strict" in Phase 1).
 */
export const DEFAULT_SAFE_MODE = "strict" as const;

/**
 * Default allowTextOverlay (always false unless explicitly set).
 */
export const DEFAULT_ALLOW_TEXT_OVERLAY = false;

// ============================================
// Provider Defaults
// ============================================

/**
 * Default provider plan (not used for actual generation in Phase 1).
 */
export const DEFAULT_PROVIDER_ID = "nano_banana" as const;
export const DEFAULT_MODEL_TIER = "flash" as const;

// ============================================
// Template IDs
// ============================================

export const TEMPLATE_IDS = {
  EDU_ABSTRACT_V1: "EDU_ABSTRACT_V1",
  PROMO_ABSTRACT_V1: "PROMO_ABSTRACT_V1",
  SOCIAL_PROOF_ABSTRACT_V1: "SOCIAL_PROOF_ABSTRACT_V1",
  LOCAL_OCALA_ABSTRACT_V1: "LOCAL_OCALA_ABSTRACT_V1",
  EVERGREEN_BRAND_PATTERN_V1: "EVERGREEN_BRAND_PATTERN_V1",
  SAFE_GENERIC_ABSTRACT_V1: "SAFE_GENERIC_ABSTRACT_V1",
} as const;

