/**
 * OBD Brand-Safe Image Generator - Public API
 * 
 * Main export for the Image Engine (Phase 1: Contract + Decision Logic, Phase 2A: Generation)
 */

import { resolveDecision } from "./decision";
import { logDecision } from "./logger";
import { assembleProviderPrompt } from "./assemble";
import { resolveSize } from "./size";
import { getProvider } from "./providers";
import { getStorage } from "./storage";
import { generateStorageKey } from "./storage/localDev";
import type {
  ImageEngineRequest,
  ImageEngineDecision,
  ImageGenerationResult,
} from "./types";

/**
 * Image Engine public API.
 * 
 * Usage:
 * ```ts
 * const decision = ImageEngine.decide(request);
 * const result = await ImageEngine.generate(request);
 * ```
 */
export const ImageEngine = {
  /**
   * Makes a decision about image generation based on the request.
   * This is deterministic: same input => same output.
   * 
   * @param request - The image generation request
   * @returns The decision object with all resolved parameters
   */
  decide(request: ImageEngineRequest): ImageEngineDecision {
    const decision = resolveDecision(request);
    logDecision(request, decision);
    return decision;
  },

  /**
   * Generates an image based on the request.
   * Never throws - always returns a result (ok=true or ok=false with fallback).
   * 
   * @param request - The image generation request
   * @returns Generation result with image URL or fallback
   */
  async generate(
    request: ImageEngineRequest
  ): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    let decisionTime = 0;
    let providerTime = 0;
    let storageTime = 0;

    try {
      // A) Get decision
      const decisionStart = Date.now();
      const decision = resolveDecision(request);
      decisionTime = Date.now() - decisionStart;
      logDecision(request, decision);

      // B) If fallback mode, return early
      if (decision.mode === "fallback") {
        return {
          requestId: request.requestId,
          ok: false,
          decision,
          fallback: {
            used: true,
            reason: decision.safety.reasons.join("; ") || "Safety evaluation failed",
          },
          timingsMs: {
            decision: decisionTime,
            total: Date.now() - startTime,
          },
        };
      }

      // C) Assemble prompt and resolve size
      const prompt = assembleProviderPrompt(decision);
      const { width, height } = resolveSize(decision.platform, decision.aspect);

      // D) Call provider
      const providerStart = Date.now();
      const provider = getProvider(decision.providerPlan.providerId);
      let imageBytes: Uint8Array;
      let contentType: "image/png" | "image/jpeg" | "image/webp";

      try {
        const providerResult = await provider.generate({
          decision,
          prompt,
          width,
          height,
          contentType: "image/png", // Default, provider may override
        });
        imageBytes = providerResult.bytes;
        contentType = providerResult.contentType;
        providerTime = Date.now() - providerStart;
      } catch (providerError) {
        // Provider failed - return fallback
        const errorMessage =
          providerError instanceof Error
            ? providerError.message
            : "Unknown provider error";
        return {
          requestId: request.requestId,
          ok: false,
          decision,
          fallback: {
            used: true,
            reason: `Provider error: ${errorMessage}`,
          },
          error: {
            code: "PROVIDER_ERROR",
            message: errorMessage,
          },
          timingsMs: {
            decision: decisionTime,
            provider: Date.now() - providerStart,
            total: Date.now() - startTime,
          },
        };
      }

      // E) Store image
      const storageStart = Date.now();
      const storage = getStorage();
      const storageKey = generateStorageKey(
        request.requestId,
        decision.platform,
        decision.category
      );

      let imageUrl: string;
      try {
        const storageResult = await storage.put({
          key: storageKey,
          bytes: imageBytes,
          contentType,
        });
        imageUrl = storageResult.url;
        storageTime = Date.now() - storageStart;
      } catch (storageError) {
        // Storage failed - return fallback
        const errorMessage =
          storageError instanceof Error
            ? storageError.message
            : "Unknown storage error";
        return {
          requestId: request.requestId,
          ok: false,
          decision,
          fallback: {
            used: true,
            reason: `Storage error: ${errorMessage}`,
          },
          error: {
            code: "STORAGE_ERROR",
            message: errorMessage,
          },
          timingsMs: {
            decision: decisionTime,
            provider: providerTime,
            storage: Date.now() - storageStart,
            total: Date.now() - startTime,
          },
        };
      }

      // F) Compute alt text (simple, safe, no business name)
      const altText = generateAltText(decision);

      // G) Return success
      return {
        requestId: request.requestId,
        ok: true,
        decision,
        image: {
          url: imageUrl,
          width,
          height,
          contentType,
          altText,
        },
        timingsMs: {
          decision: decisionTime,
          provider: providerTime,
          storage: storageTime,
          total: Date.now() - startTime,
        },
      };
    } catch (error) {
      // Unexpected error - return fallback
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        requestId: request.requestId,
        ok: false,
        decision: resolveDecision(request), // Get decision even on error
        fallback: {
          used: true,
          reason: `Unexpected error: ${errorMessage}`,
        },
        error: {
          code: "UNEXPECTED_ERROR",
          message: errorMessage,
        },
        timingsMs: {
          decision: 0,
          total: Date.now() - startTime,
        },
      };
    }
  },
};

/**
 * Generates safe alt text for the image.
 * No business names, no PII.
 */
function generateAltText(decision: ImageEngineDecision): string {
  const categoryMap: Record<ImageEngineDecision["category"], string> = {
    educational: "Educational visual",
    promotion: "Promotional visual",
    social_proof: "Trust and quality visual",
    local_abstract: "Local community visual",
    evergreen: "Brand pattern visual",
  };

  const categoryText = categoryMap[decision.category] || "Abstract visual";
  const platformText = decision.platform.replace(/_/g, " ");

  return `${categoryText} for ${platformText}`;
}

// Re-export types for consumers
export type {
  ImageEngineRequest,
  ImageEngineDecision,
  ImageGenerationResult,
  ImagePlatform,
  ImageAspect,
  ImageCategory,
  ImageEnergy,
  TextAllowance,
  DecisionMode,
  ImageProviderId,
  ConsumerApp,
  BrandKitInfluence,
} from "./types";

