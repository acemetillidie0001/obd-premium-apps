/**
 * OBD Brand-Safe Image Generator - Prompt Planning
 * 
 * Builds prompt template plans (not raw prompts for end users).
 * These are structured plans that will be used by providers in Phase 2.
 */

import type { ImageEngineRequest, ImageEngineDecision } from "./types";
import { TEMPLATE_IDS } from "./constants";

// ============================================
// Base Negative Rules
// ============================================

/**
 * Base negative rules that apply to all image generation.
 * These are hard-locked safety rules.
 */
const BASE_NEGATIVE_RULES: string[] = [
  "no logos",
  "no brand names",
  "no readable storefront signs",
  "no faces",
  "no identifiable people",
  "no copyrighted characters",
  "no celebrity likeness",
  "no 'in the style of' artists",
  "no medical/legal claims",
  "no before/after",
  "no fake reviews",
];

// ============================================
// Template Variable Building
// ============================================

/**
 * Builds variables for prompt templates based on request and resolved decision.
 */
function buildVariables(
  request: ImageEngineRequest,
  resolved: Omit<ImageEngineDecision, "promptPlan" | "providerPlan">
): Record<string, string> {
  const variables: Record<string, string> = {};

  // Style tone (default "clean")
  variables.styleTone = request.brand?.styleTone || "clean";

  // Brand colors (optional)
  if (request.brand?.primaryColorHex) {
    variables.primaryColorHex = request.brand.primaryColorHex;
  }
  if (request.brand?.accentColorHex) {
    variables.accentColorHex = request.brand.accentColorHex;
  }

  // Industry (optional)
  if (request.brand?.industry) {
    variables.industry = request.brand.industry;
  }

  // Locale abstract (e.g., "subtle Ocala Florida vibe, abstract only")
  if (request.locale?.city || request.locale?.region) {
    const city = request.locale.city || "";
    const region = request.locale.region || "";
    const localeParts = [city, region].filter(Boolean).join(" ");
    if (localeParts) {
      variables.localeAbstract = `subtle ${localeParts} vibe, abstract only`;
    }
  }

  // Intent summary (sanitized - we don't log the full thing, but use it in variables)
  variables.intentSummary = request.intentSummary.trim();

  // Energy level
  variables.energy = resolved.energy;

  // Category
  variables.category = resolved.category;

  return variables;
}

// ============================================
// Prompt Plan Building
// ============================================

/**
 * Builds a prompt plan based on the request and resolved decision.
 */
export function buildPromptPlan(
  request: ImageEngineRequest,
  resolved: Omit<ImageEngineDecision, "promptPlan" | "providerPlan">
): ImageEngineDecision["promptPlan"] {
  // Determine template ID based on category and mode
  let templateId: string;

  if (resolved.mode === "fallback") {
    templateId = TEMPLATE_IDS.SAFE_GENERIC_ABSTRACT_V1;
  } else {
    switch (resolved.category) {
      case "educational":
        templateId = TEMPLATE_IDS.EDU_ABSTRACT_V1;
        break;
      case "promotion":
        templateId = TEMPLATE_IDS.PROMO_ABSTRACT_V1;
        break;
      case "social_proof":
        templateId = TEMPLATE_IDS.SOCIAL_PROOF_ABSTRACT_V1;
        break;
      case "local_abstract":
        templateId = TEMPLATE_IDS.LOCAL_OCALA_ABSTRACT_V1;
        break;
      case "evergreen":
        templateId = TEMPLATE_IDS.EVERGREEN_BRAND_PATTERN_V1;
        break;
      default:
        templateId = TEMPLATE_IDS.SAFE_GENERIC_ABSTRACT_V1;
    }
  }

  // Build variables
  const variables = buildVariables(request, resolved);

  // Negative rules (always include base rules)
  const negativeRules = [...BASE_NEGATIVE_RULES];

  // Add category-specific negative rules if needed
  if (resolved.category === "social_proof") {
    negativeRules.push("no text overlays", "no quotes", "no speech bubbles");
  }

  return {
    templateId,
    negativeRules,
    variables,
  };
}

