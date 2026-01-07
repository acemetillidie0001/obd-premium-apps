/**
 * OBD Brand-Safe Image Generator - Generation API Route
 * 
 * POST /api/image-engine/generate
 * 
 * Generates an image based on the request (Phase 2A).
 * Always returns 200 with ok=true/false in payload (never throws).
 */

import { NextRequest, NextResponse } from "next/server";
import { ImageEngine } from "@/lib/image-engine";
import type { ImageEngineRequest } from "@/lib/image-engine/types";
import { upsertImageRequestFromResult } from "@/lib/image-engine/db";
import { generateWithProvider } from "@/lib/image-engine/providers";
import type { ImageProviderName } from "@/lib/image-engine/providers/types";
import { resolveSize } from "@/lib/image-engine/size";
import { writeToStorage } from "@/lib/image-engine/storage";
import type { StorageName } from "@/lib/image-engine/storage/types";
import { evaluateSafety } from "@/lib/image-engine/safety/evaluate";
import { logEngineEvent } from "@/lib/image-engine/events/log";
import { buildImagePrompt } from "@/lib/image-engine/prompts/buildPrompt";
import { buildAltText } from "@/lib/image-engine/prompts/buildAltText";

/**
 * Maps decision category to prompt builder category.
 */
function mapCategoryToPromptCategory(
  category: string
): "evergreen" | "promo" | "event" | "review" | "seasonal" | "announcement" {
  switch (category) {
    case "evergreen":
      return "evergreen";
    case "promotion":
      return "promo";
    case "social_proof":
      return "review";
    case "local_abstract":
      return "event";
    case "educational":
      return "announcement";
    default:
      return "evergreen";
  }
}

/**
 * Maps style tone to business vibe.
 */
function mapStyleToneToVibe(
  styleTone?: string
): "professional" | "friendly" | "luxury" | "bold" | undefined {
  if (!styleTone) return undefined;
  
  const tone = styleTone.toLowerCase();
  if (tone.includes("luxury") || tone.includes("elegant")) return "luxury";
  if (tone.includes("bold") || tone.includes("confident")) return "bold";
  if (tone.includes("friendly") || tone.includes("warm")) return "friendly";
  if (tone.includes("professional") || tone.includes("clean")) return "professional";
  
  return undefined;
}

/**
 * POST /api/image-engine/generate
 * 
 * Validates request body and generates an image.
 * Always returns 200 (consumers must check ok field in response).
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    const body: unknown = await request.json();

    // Validate request shape (reuse validation from decision route)
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be an object" },
        { status: 400 }
      );
    }

    const req = body as Partial<ImageEngineRequest>;

    // Required fields validation
    if (!req.requestId || typeof req.requestId !== "string" || req.requestId.trim().length === 0) {
      return NextResponse.json(
        { error: "requestId is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!req.consumerApp || typeof req.consumerApp !== "string") {
      return NextResponse.json(
        { error: "consumerApp is required and must be a string" },
        { status: 400 }
      );
    }

    const validConsumerApps = [
      "social_auto_poster",
      "offers_promotions",
      "event_campaign",
      "review_responder",
      "brand_kit_builder",
      "seo_audit_roadmap",
      "other",
    ];
    if (!validConsumerApps.includes(req.consumerApp)) {
      return NextResponse.json(
        { error: `consumerApp must be one of: ${validConsumerApps.join(", ")}` },
        { status: 400 }
      );
    }

    if (!req.platform || typeof req.platform !== "string") {
      return NextResponse.json(
        { error: "platform is required and must be a string" },
        { status: 400 }
      );
    }

    const validPlatforms = ["instagram", "facebook", "x", "google_business_profile", "blog"];
    if (!validPlatforms.includes(req.platform)) {
      return NextResponse.json(
        { error: `platform must be one of: ${validPlatforms.join(", ")}` },
        { status: 400 }
      );
    }

    if (!req.category || typeof req.category !== "string") {
      return NextResponse.json(
        { error: "category is required and must be a string" },
        { status: 400 }
      );
    }

    const validCategories = ["educational", "promotion", "social_proof", "local_abstract", "evergreen"];
    if (!validCategories.includes(req.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    if (!req.intentSummary || typeof req.intentSummary !== "string") {
      return NextResponse.json(
        { error: "intentSummary is required and must be a string" },
        { status: 400 }
      );
    }

    // Optional fields validation
    if (req.brand !== undefined && (typeof req.brand !== "object" || req.brand === null)) {
      return NextResponse.json(
        { error: "brand must be an object if provided" },
        { status: 400 }
      );
    }

    if (req.locale !== undefined && (typeof req.locale !== "object" || req.locale === null)) {
      return NextResponse.json(
        { error: "locale must be an object if provided" },
        { status: 400 }
      );
    }

    if (req.allowTextOverlay !== undefined && typeof req.allowTextOverlay !== "boolean") {
      return NextResponse.json(
        { error: "allowTextOverlay must be a boolean if provided" },
        { status: 400 }
      );
    }

    if (req.safeMode !== undefined && req.safeMode !== "strict") {
      return NextResponse.json(
        { error: 'safeMode must be "strict" if provided' },
        { status: 400 }
      );
    }

    // Build validated request
    const validatedRequest: ImageEngineRequest = {
      requestId: req.requestId.trim(),
      consumerApp: req.consumerApp,
      platform: req.platform,
      category: req.category,
      intentSummary: req.intentSummary.trim(),
      brand: req.brand,
      locale: req.locale,
      allowTextOverlay: req.allowTextOverlay,
      safeMode: req.safeMode,
    };

    // Log generation start (non-blocking)
    try {
      await logEngineEvent({
        requestId: validatedRequest.requestId,
        type: "generate_start",
        ok: true,
        messageSafe: "Generation started",
        data: {
          platform: validatedRequest.platform,
          category: validatedRequest.category,
        },
      });
    } catch (dbError) {
      console.warn("[ImageEngine Generate API] DB event log failed (start):", dbError);
    }

    // Get decision and assemble prompt
    const decision = ImageEngine.decide(validatedRequest);
    
    // If fallback mode, return early
    if (decision.mode === "fallback") {
      const fallbackResult = {
        requestId: validatedRequest.requestId,
        ok: false,
        decision,
        fallback: {
          used: true,
          reason: decision.safety.reasons.join("; ") || "Safety evaluation failed",
        },
        timingsMs: {
          decision: 0,
          total: 0,
        },
      };
      
      // Persist and return
      try {
        await upsertImageRequestFromResult(fallbackResult);
        await logEngineEvent({
          requestId: validatedRequest.requestId,
          type: "generate_finish",
          ok: false,
          messageSafe: fallbackResult.fallback.reason,
          data: { fallbackReason: fallbackResult.fallback.reason },
        });
      } catch (dbError) {
        console.warn("[ImageEngine Generate API] DB persistence failed:", dbError);
      }
      
      return NextResponse.json(fallbackResult);
    }

    // Evaluate safety rules (deterministic, so safe to re-evaluate)
    // Safety rules may have been evaluated in decision route, but we re-evaluate here
    // to ensure consistency even if generate is called independently
    const safetyResult = evaluateSafety({
      platform: decision.platform,
      category: decision.category,
      aspect: decision.aspect,
      mode: decision.mode,
      negativeRules: decision.promptPlan.negativeRules,
      businessName: validatedRequest.brand?.industry,
      userText: validatedRequest.intentSummary,
    });
    
    // Check safety rules verdict
    const safetyRules = safetyResult;
    
    // If safety verdict is "block", skip generation
    if (safetyRules?.verdict === "block") {
      const blockedResult = {
        requestId: validatedRequest.requestId,
        ok: false,
        decision,
        fallback: {
          used: true,
          reason: safetyRules.reasonSafe || "Request blocked by safety rules",
        },
        error: {
          code: "SAFETY_BLOCKED",
          message: safetyRules.reasonSafe || "Request blocked by safety rules",
        },
        timingsMs: {
          decision: 0,
          total: 0,
        },
      };
      
      // Persist with status="skipped" (non-blocking)
      try {
        await upsertImageRequestFromResult(blockedResult);
        await logEngineEvent({
          requestId: validatedRequest.requestId,
          type: "generate_finish",
          ok: false,
          messageSafe: safetyRules.reasonSafe || "Generation blocked by safety rules",
          data: {
            verdict: "block",
            tags: safetyRules.tags || [],
          },
        });
      } catch (dbError) {
        console.warn("[ImageEngine Generate API] DB persistence failed:", dbError);
      }
      
      return NextResponse.json(blockedResult);
    }
    
    // If safety verdict is "fallback", skip provider call and return fallback
    if (safetyRules?.verdict === "fallback") {
      const fallbackResult = {
        requestId: validatedRequest.requestId,
        ok: false,
        decision,
        fallback: {
          used: true,
          reason: safetyRules.reasonSafe || "Request requires fallback due to safety rules",
        },
        timingsMs: {
          decision: 0,
          total: 0,
        },
      };
      
      // Persist with status="fallback" (non-blocking)
      try {
        await upsertImageRequestFromResult(fallbackResult);
        await logEngineEvent({
          requestId: validatedRequest.requestId,
          type: "generate_finish",
          ok: false,
          messageSafe: safetyRules.reasonSafe || "Generation skipped - using fallback",
          data: {
            verdict: "fallback",
            tags: safetyRules.tags || [],
          },
        });
      } catch (dbError) {
        console.warn("[ImageEngine Generate API] DB persistence failed:", dbError);
      }
      
      return NextResponse.json(fallbackResult);
    }
    
    // Build prompt (exists ONLY in memory, never persisted)
    const promptInput = {
      requestId: validatedRequest.requestId,
      platform: decision.platform as "instagram" | "facebook" | "x" | "google_business_profile" | "website",
      category: mapCategoryToPromptCategory(decision.category),
      aspect: decision.aspect,
      safety: {
        negativeRules: decision.promptPlan.negativeRules,
        verdict: safetyResult.verdict,
      },
      businessHints: {
        industry: validatedRequest.brand?.industry,
        vibe: mapStyleToneToVibe(decision.promptPlan.variables.styleTone),
      },
      mode: decision.mode,
    };

    const promptResult = buildImagePrompt(promptInput);
    // promptResult.prompt and promptResult.negativePrompt exist ONLY in memory
    // They are NEVER stored, logged, or persisted anywhere

    // Resolve size
    const { width, height } = resolveSize(decision.platform, decision.aspect);
    
    // Determine provider from decision (map to new provider name format)
    const providerId = decision.providerPlan.providerId;
    const provider: ImageProviderName = providerId === "openai" ? "openai" : "nano_banana";
    
    // Call provider adapter layer (prompt passed here, but never stored)
    const providerStart = Date.now();
    let providerResult;
    try {
      providerResult = await generateWithProvider(provider, {
        requestId: validatedRequest.requestId,
        width,
        height,
        prompt: promptResult.prompt, // Pass prompt to provider (memory only)
        negativePrompt: promptResult.negativePrompt, // Pass negative prompt (memory only)
      });
    } catch (providerError) {
      // Provider call threw - return fallback
      const errorMessage =
        providerError instanceof Error
          ? providerError.message
          : "Unknown provider error";
      
      const errorResult = {
        requestId: validatedRequest.requestId,
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
          decision: 0,
          provider: Date.now() - providerStart,
          total: Date.now() - providerStart,
        },
      };
      
      // Log provider call failure (non-blocking)
      try {
        await logEngineEvent({
          requestId: validatedRequest.requestId,
          type: "provider_call",
          ok: false,
          messageSafe: errorMessage,
          data: { errorCode: "PROVIDER_ERROR" },
        });
        await upsertImageRequestFromResult(errorResult);
      } catch (dbError) {
        console.warn("[ImageEngine Generate API] DB persistence failed:", dbError);
      }
      
      return NextResponse.json(errorResult);
    }
    
    const providerTime = Date.now() - providerStart;
    
    // Log provider call result (non-blocking)
    try {
      await logEngineEvent({
        requestId: validatedRequest.requestId,
        type: "provider_call",
        ok: providerResult.ok,
        messageSafe: providerResult.ok
          ? "Provider call succeeded"
          : providerResult.errorMessageSafe || "Provider call failed",
        data: {
          provider: providerResult.provider,
          errorCode: providerResult.errorCode,
        },
      });
    } catch (dbError) {
      console.warn("[ImageEngine Generate API] DB event log failed (provider):", dbError);
    }
    
    // If provider failed, return fallback
    if (!providerResult.ok || !providerResult.imageBytes) {
      const fallbackResult = {
        requestId: validatedRequest.requestId,
        ok: false,
        decision,
        fallback: {
          used: true,
          reason: providerResult.errorMessageSafe || "Provider returned no image",
        },
        error: {
          code: providerResult.errorCode || "PROVIDER_ERROR",
          message: providerResult.errorMessageSafe || "Provider call failed",
        },
        timingsMs: {
          decision: 0,
          provider: providerTime,
          total: providerTime,
        },
      };
      
      try {
        await upsertImageRequestFromResult(fallbackResult);
        await logEngineEvent({
          requestId: validatedRequest.requestId,
          type: "generate_finish",
          ok: false,
          messageSafe: fallbackResult.fallback.reason,
          data: { fallbackReason: fallbackResult.fallback.reason },
        });
      } catch (dbError) {
        console.warn("[ImageEngine Generate API] DB persistence failed:", dbError);
      }
      
      return NextResponse.json(fallbackResult);
    }
    
    // Convert Buffer to bytes for storage
    const imageBytes = Buffer.from(providerResult.imageBytes);
    const mimeType = providerResult.mimeType || "image/png";
    
    // Choose storage backend based on environment
    const storageName: StorageName =
      process.env.NODE_ENV !== "production" ? "local_dev" : "vercel_blob";
    
    // Store image using unified storage layer
    const storageStart = Date.now();
    const storageResult = await writeToStorage(storageName, {
      requestId: validatedRequest.requestId,
      bytes: imageBytes,
      mimeType,
    });
    
    const storageTime = Date.now() - storageStart;
    
    // Log storage write event (non-blocking)
    try {
      await logEngineEvent({
        requestId: validatedRequest.requestId,
        type: "storage_write",
        ok: storageResult.ok,
        messageSafe: storageResult.ok
          ? "Storage write succeeded"
          : storageResult.errorMessageSafe || "Storage write failed",
        data: {
          storage: storageResult.storage,
          errorCode: storageResult.errorCode,
        },
      });
    } catch (dbError) {
      console.warn("[ImageEngine Generate API] DB event log failed (storage):", dbError);
    }
    
    // If storage failed, return error result
    if (!storageResult.ok || !storageResult.url) {
      const storageErrorResult = {
        requestId: validatedRequest.requestId,
        ok: false,
        decision,
        fallback: {
          used: true,
          reason: storageResult.errorMessageSafe || "Storage write failed",
        },
        error: {
          code: storageResult.errorCode || "STORAGE_ERROR",
          message: storageResult.errorMessageSafe || "Storage write failed",
        },
        timingsMs: {
          decision: 0,
          provider: providerTime,
          storage: storageTime,
          total: providerTime + storageTime,
        },
      };
      
      try {
        await upsertImageRequestFromResult(storageErrorResult, storageName);
      } catch (dbError) {
        console.warn("[ImageEngine Generate API] DB persistence failed:", dbError);
      }
      
      return NextResponse.json(storageErrorResult);
    }
    
    const imageUrl = storageResult.url;
    
    // Build alt text using builder (safe to persist - generic, no business names)
    const altText = buildAltText({
      platform: decision.platform,
      category: decision.category,
      aspect: decision.aspect,
    });
    
    // Determine content type from mimeType
    const contentType = (mimeType as "image/png" | "image/jpeg" | "image/webp") || "image/png";
    
    // Build success result
    // NOTE: prompt and negativePrompt are NOT included in result
    // They exist only in memory and are never persisted
    const result = {
      requestId: validatedRequest.requestId,
      ok: true,
      decision,
      image: {
        url: imageUrl,
        width,
        height,
        contentType,
        altText, // Alt text is safe to persist (generic, no business names)
      },
      timingsMs: {
        decision: 0,
        provider: providerTime,
        storage: storageTime,
        total: providerTime + storageTime,
      },
    };

    // Persist result and log completion (non-blocking)
    try {
      await upsertImageRequestFromResult(result, storageName);
      await logEngineEvent({
        requestId: result.requestId,
        type: "generate_finish",
        ok: true,
        messageSafe: "Generation completed successfully",
        data: {
          imageUrl: result.image.url,
          width: result.image.width,
          height: result.image.height,
        },
      });
    } catch (dbError) {
      // Non-blocking: log but don't fail the request
      console.warn("[ImageEngine Generate API] DB persistence failed:", dbError);
    }

    // Always return 200 (consumers check ok field)
    return NextResponse.json(result);
  } catch (error) {
    // Only validation errors should reach here
    console.error("[ImageEngine Generate API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

