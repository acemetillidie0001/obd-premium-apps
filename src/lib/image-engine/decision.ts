/**
 * OBD Brand-Safe Image Generator - Decision Resolution
 * 
 * Implements deterministic decision logic (same input => same decision).
 */

import type { ImageEngineRequest, ImageEngineDecision } from "./types";
import {
  PLATFORM_ASPECT_DEFAULTS,
  CATEGORY_DEFAULTS,
  DEFAULT_SAFE_MODE,
  DEFAULT_ALLOW_TEXT_OVERLAY,
  DEFAULT_PROVIDER_ID,
  DEFAULT_MODEL_TIER,
} from "./constants";
import { evaluateSafety } from "./safety";
import { buildPromptPlan } from "./prompts";

// ============================================
// Decision Resolution
// ============================================

/**
 * Resolves an image generation decision based on the request.
 * This is deterministic: same input => same output.
 */
export function resolveDecision(request: ImageEngineRequest): ImageEngineDecision {
  // A) Normalize defaults
  const safeMode = request.safeMode || DEFAULT_SAFE_MODE;
  const allowTextOverlay = request.allowTextOverlay ?? DEFAULT_ALLOW_TEXT_OVERLAY;

  // B) Pick aspect from platform mapping
  const aspect = PLATFORM_ASPECT_DEFAULTS[request.platform];

  // C) Apply category defaults (energy, text allowance)
  const categoryDefaults = CATEGORY_DEFAULTS[request.category];
  let energy: ImageEngineDecision["energy"] = categoryDefaults.energy;
  let textAllowance: ImageEngineDecision["text"]["allowance"] = categoryDefaults.textAllowance;

  // Override text allowance based on allowTextOverlay
  // Even if category default allows text, if allowTextOverlay is false, set to "none"
  if (!allowTextOverlay) {
    textAllowance = "none";
  } else {
    // If allowTextOverlay is true, use category default (but still respect category rules)
    // For social_proof, always "none" regardless
    if (request.category === "social_proof") {
      textAllowance = "none";
    }
    // Otherwise, use the category default
  }

  // D) Run safety evaluation
  const safetyResult = evaluateSafety(request);

  // E) Determine mode and usedFallback
  let mode: ImageEngineDecision["mode"];
  let usedFallback: boolean;

  if (!safetyResult.isAllowed) {
    mode = "fallback";
    usedFallback = true;
    // Override text allowance to "none" for fallback
    textAllowance = "none";
  } else {
    mode = "generate";
    usedFallback = false;
  }

  // F) Build safety object
  const safety = {
    isAllowed: safetyResult.isAllowed,
    reasons: safetyResult.reasons,
    usedFallback,
  };

  // G) Build provider plan (just a plan, no actual generation)
  const providerPlan = {
    providerId: DEFAULT_PROVIDER_ID,
    modelTier: DEFAULT_MODEL_TIER,
    notes: mode === "fallback" ? "Using safe generic template due to safety evaluation" : undefined,
  };

  // H) Build the decision object (without promptPlan and providerPlan first)
  const decisionWithoutPlans: Omit<ImageEngineDecision, "promptPlan" | "providerPlan"> = {
    requestId: request.requestId,
    mode,
    platform: request.platform,
    aspect,
    category: request.category,
    energy,
    text: {
      allowance: textAllowance,
      recommendedOverlayText: null, // Phase 1: no overlay text recommendations
    },
    safety,
  };

  // I) Build prompt plan
  const promptPlan = buildPromptPlan(request, decisionWithoutPlans);

  // J) Return complete decision
  return {
    ...decisionWithoutPlans,
    promptPlan,
    providerPlan,
  };
}

