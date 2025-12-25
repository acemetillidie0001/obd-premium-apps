/**
 * OBD Social Auto-Poster - Image Engine Client
 * 
 * Client wrapper for the shared image engine API.
 * Handles network failures gracefully and never throws.
 */

import type {
  ImageEngineRequest,
  ImageEngineDecision,
  ImageGenerationResult,
} from "@/lib/image-engine/types";

/**
 * Requests an image generation decision from the image engine.
 * 
 * @param request - Image engine request
 * @returns Decision (or synthetic fallback if engine unavailable)
 */
export async function requestImageDecision(
  request: ImageEngineRequest
): Promise<ImageEngineDecision> {
  try {
    const response = await fetch("/api/image-engine/decision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      // Return synthetic fallback decision
      return createFallbackDecision(request);
    }

    const data = await response.json();
    return data as ImageEngineDecision;
  } catch (error) {
    // Network or other error - return synthetic fallback
    console.warn("[ImageEngineClient] Decision request failed:", error);
    return createFallbackDecision(request);
  }
}

/**
 * Generates an image using the image engine.
 * Never throws - always returns a result (ok=true or ok=false with fallback).
 * 
 * @param request - Image engine request
 * @returns Generation result (or fallback if engine unavailable)
 */
export async function generateImage(
  request: ImageEngineRequest
): Promise<ImageGenerationResult> {
  try {
    const response = await fetch("/api/image-engine/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      // Return fallback result
      const fallback = createFallbackGenerationResult(request);
      // Minimal logging
      console.log("[ImageEngineClient]", {
        requestId: request.requestId,
        platform: request.platform,
        ok: false,
      });
      return fallback;
    }

    const data = await response.json();
    const result = data as ImageGenerationResult;
    
    // Minimal logging
    console.log("[ImageEngineClient]", {
      requestId: request.requestId,
      platform: request.platform,
      ok: result.ok,
    });
    
    return result;
  } catch (error) {
    // Network or other error - return fallback
    const fallback = createFallbackGenerationResult(request);
    // Minimal logging
    console.log("[ImageEngineClient]", {
      requestId: request.requestId,
      platform: request.platform,
      ok: false,
    });
    return fallback;
  }
}

/**
 * Creates a synthetic fallback decision when the engine is unavailable.
 */
function createFallbackDecision(
  request: ImageEngineRequest
): ImageEngineDecision {
  return {
    requestId: request.requestId,
    mode: "fallback",
    platform: request.platform,
    aspect: "4:5", // Safe default
    category: request.category,
    energy: "medium",
    text: {
      allowance: "none",
      recommendedOverlayText: null,
    },
    safety: {
      isAllowed: false,
      reasons: ["Engine unavailable"],
      usedFallback: true,
    },
    promptPlan: {
      templateId: "SAFE_GENERIC_ABSTRACT_V1",
      negativeRules: [
        "no logos",
        "no brand names",
        "no faces",
        "no identifiable people",
      ],
      variables: {},
    },
    providerPlan: {
      providerId: "other",
      modelTier: "flash",
      notes: "Engine unavailable - using fallback",
    },
  };
}

/**
 * Creates a fallback generation result when the engine is unavailable.
 */
function createFallbackGenerationResult(
  request: ImageEngineRequest
): ImageGenerationResult {
  const fallbackDecision = createFallbackDecision(request);
  return {
    requestId: request.requestId,
    ok: false,
    decision: fallbackDecision,
    fallback: {
      used: true,
      reason: "ENGINE_UNAVAILABLE",
    },
    error: {
      code: "ENGINE_UNAVAILABLE",
      message: "Image engine is unavailable",
    },
    timingsMs: {
      decision: 0,
      total: 0,
    },
  };
}

