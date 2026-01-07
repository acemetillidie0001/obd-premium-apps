/**
 * OBD Brand-Safe Image Generator - Regenerate API Route
 * 
 * POST /api/image-engine/regenerate
 * 
 * Regenerates an image for an existing ImageRequest by requestId.
 * Uses stored decisionJson to rebuild prompt in-memory.
 * Prompts exist ONLY in memory - never persisted.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
import type { ImageEngineDecision, ImageAspect, ImagePlatform } from "@/lib/image-engine/types";

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
 * POST /api/image-engine/regenerate
 * 
 * Body: { requestId: string }
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Request body must be an object" },
        { status: 200 }
      );
    }

    const req = body as { requestId?: string };
    if (!req.requestId || typeof req.requestId !== "string") {
      return NextResponse.json(
        { ok: false, errorCode: "MISSING_REQUEST_ID" },
        { status: 200 }
      );
    }

    const requestId = req.requestId.trim();

    // Fetch ImageRequest with all needed fields
    const imageRequest = await prisma.imageRequest.findUnique({
      where: { requestId },
      select: {
        requestId: true,
        platform: true,
        category: true,
        aspect: true,
        width: true,
        height: true,
        status: true,
        decisionJson: true,
      },
    });

    if (!imageRequest) {
      return NextResponse.json(
        { ok: false, errorCode: "NOT_FOUND" },
        { status: 200 }
      );
    }

    // Extract decisionJson
    const decisionJson = imageRequest.decisionJson as any;
    if (!decisionJson || typeof decisionJson !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid decisionJson in ImageRequest" },
        { status: 200 }
      );
    }

    // Reconstruct ImageEngineDecision from decisionJson
    const decision: ImageEngineDecision = {
      requestId,
      mode: decisionJson.mode || "generate",
      platform: decisionJson.platform,
      aspect: decisionJson.aspect,
      category: decisionJson.category,
      energy: decisionJson.energy || "medium",
      text: {
        allowance: decisionJson.text?.allowance || "none",
        recommendedOverlayText: decisionJson.text?.recommendedOverlayText || null,
      },
      safety: {
        isAllowed: decisionJson.safety?.isAllowed ?? true,
        reasons: decisionJson.safety?.reasons || [],
        usedFallback: decisionJson.safety?.usedFallback || false,
      },
      promptPlan: {
        templateId: decisionJson.promptPlan?.templateId || "",
        negativeRules: decisionJson.promptPlan?.negativeRules || [],
        variables: decisionJson.promptPlan?.variables || {},
      },
      providerPlan: {
        providerId: decisionJson.providerPlan?.providerId || "nano_banana",
        modelTier: decisionJson.providerPlan?.modelTier || "flash",
        notes: decisionJson.providerPlan?.notes,
      },
    };

    // Log regeneration start
    try {
      await logEngineEvent({
        requestId,
        type: "generate_start",
        ok: true,
        messageSafe: "Regeneration started",
        data: {
          platform: decision.platform,
          category: decision.category,
        },
      });
    } catch (dbError) {
      console.warn("[ImageEngine Regenerate API] DB event log failed (start):", dbError);
    }

    // Re-evaluate safety rules (deterministic) - using ONLY safe stored fields
    // Do NOT use user text (intentSummary) - only use safe metadata
    const safetyResult = evaluateSafety({
      platform: imageRequest.platform,
      category: imageRequest.category,
      aspect: imageRequest.aspect,
      mode: decision.mode,
      negativeRules: decision.promptPlan.negativeRules || [],
      businessName: decision.promptPlan.variables?.industry || undefined,
      userText: "", // Never use user text in regeneration
    });

    // Attach safety result to decision
    const decisionWithSafety = {
      ...decision,
      safetyResult,
    };

    // If safety verdict is "block", skip generation
    if (safetyResult.verdict === "block") {
      const blockedResult = {
        requestId,
        ok: false,
        decision: decisionWithSafety as any,
        fallback: {
          used: true,
          reason: safetyResult.reasonSafe || "Request blocked by safety rules",
        },
        error: {
          code: "SAFETY_BLOCKED",
          message: safetyResult.reasonSafe || "Request blocked by safety rules",
        },
        timingsMs: {
          decision: 0,
          total: 0,
        },
      };

      try {
        await upsertImageRequestFromResult(blockedResult);
        await logEngineEvent({
          requestId,
          type: "generate_finish",
          ok: false,
          messageSafe: safetyResult.reasonSafe || "Generation blocked by safety rules",
          data: {
            verdict: "block",
            tags: safetyResult.tags || [],
          },
        });
      } catch (dbError) {
        console.warn("[ImageEngine Regenerate API] DB persistence failed:", dbError);
      }

      return NextResponse.json(blockedResult);
    }

    // If safety verdict is "fallback", skip provider call and return fallback
    if (safetyResult.verdict === "fallback") {
      const fallbackResult = {
        requestId,
        ok: false,
        decision: decisionWithSafety as any,
        fallback: {
          used: true,
          reason: safetyResult.reasonSafe || "Request requires fallback due to safety rules",
        },
        error: {
          code: "SAFETY_FALLBACK",
          message: safetyResult.reasonSafe || "Request requires fallback due to safety rules",
        },
        timingsMs: {
          decision: 0,
          total: 0,
        },
      };

      try {
        await upsertImageRequestFromResult(fallbackResult);
        await logEngineEvent({
          requestId,
          type: "generate_finish",
          ok: false,
          messageSafe: safetyResult.reasonSafe || "Generation skipped - using fallback",
          data: {
            verdict: "fallback",
            tags: safetyResult.tags || [],
          },
        });
      } catch (dbError) {
        console.warn("[ImageEngine Regenerate API] DB persistence failed:", dbError);
      }

      return NextResponse.json(fallbackResult);
    }

    // Build prompt (exists ONLY in memory, never persisted)
    // Use ImageRequest fields directly (platform/category/aspect from DB)
    // Map Prisma enum to prompt builder platform type
    const platformMap: Record<string, "instagram" | "facebook" | "x" | "google_business_profile" | "website"> = {
      instagram: "instagram",
      facebook: "facebook",
      x: "x",
      gbp: "google_business_profile",
      website: "website",
    };
    const promptPlatform = platformMap[imageRequest.platform] || "website";
    
    // Cast aspect to ImageAspect type
    const aspect = imageRequest.aspect as ImageAspect;
    
    // Map prompt platform to ImageEngine ImagePlatform type for resolveSize
    const enginePlatformMap: Record<string, ImagePlatform> = {
      instagram: "instagram",
      facebook: "facebook",
      x: "x",
      google_business_profile: "google_business_profile",
      website: "blog", // Map website to blog for ImageEngine types
    };
    const enginePlatform = enginePlatformMap[promptPlatform] || "blog";

    const promptInput = {
      requestId,
      platform: promptPlatform,
      category: mapCategoryToPromptCategory(imageRequest.category),
      aspect: aspect,
      safety: {
        negativeRules: decision.promptPlan.negativeRules || [],
        verdict: safetyResult.verdict,
      },
      businessHints: {
        industry: decision.promptPlan.variables?.industry || undefined,
        vibe: mapStyleToneToVibe(decision.promptPlan.variables?.styleTone),
      },
      mode: decision.mode,
    };

    const promptResult = buildImagePrompt(promptInput);
    // promptResult.prompt and promptResult.negativePrompt exist ONLY in memory
    // They are NEVER logged, stored, or persisted anywhere

    // Use stored width/height from ImageRequest, or resolve if missing
    // Use mapped platform type for resolveSize
    const width = imageRequest.width || resolveSize(enginePlatform, aspect).width;
    const height = imageRequest.height || resolveSize(enginePlatform, aspect).height;
    
    // Determine provider from decisionJson providerPlan, default to nano_banana
    const providerId = decision.providerPlan?.providerId;
    const provider: ImageProviderName = providerId === "openai" ? "openai" : "nano_banana";
    
    // Call provider adapter layer (prompt passed here, but never stored)
    const providerStart = Date.now();
    let providerResult;
    try {
      providerResult = await generateWithProvider(provider, {
        requestId,
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
        requestId,
        ok: false,
        decision: decisionWithSafety as any,
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

      try {
        await logEngineEvent({
          requestId,
          type: "provider_call",
          ok: false,
          messageSafe: errorMessage,
          data: { errorCode: "PROVIDER_ERROR" },
        });
        await upsertImageRequestFromResult(errorResult);
      } catch (dbError) {
        console.warn("[ImageEngine Regenerate API] DB persistence failed:", dbError);
      }
      
      return NextResponse.json(errorResult);
    }
    
    const providerTime = Date.now() - providerStart;
    
    // Log provider call result (non-blocking)
    try {
      await logEngineEvent({
        requestId,
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
      console.warn("[ImageEngine Regenerate API] DB event log failed (provider):", dbError);
    }
    
    // If provider failed, return fallback
    if (!providerResult.ok || !providerResult.imageBytes) {
      const fallbackResult = {
        requestId,
        ok: false,
        decision: decisionWithSafety as any,
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
          requestId,
          type: "generate_finish",
          ok: false,
          messageSafe: fallbackResult.fallback.reason,
          data: { fallbackReason: fallbackResult.fallback.reason },
        });
      } catch (dbError) {
        console.warn("[ImageEngine Regenerate API] DB persistence failed:", dbError);
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
      requestId,
      bytes: imageBytes,
      mimeType,
    });
    
    const storageTime = Date.now() - storageStart;
    
    // Log storage write event (non-blocking)
    try {
      await logEngineEvent({
        requestId,
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
      console.warn("[ImageEngine Regenerate API] DB event log failed (storage):", dbError);
    }
    
    // If storage failed, return error result
    if (!storageResult.ok || !storageResult.url) {
      const storageErrorResult = {
        requestId,
        ok: false,
        decision: decisionWithSafety as any,
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
        console.warn("[ImageEngine Regenerate API] DB persistence failed:", dbError);
      }
      
      return NextResponse.json(storageErrorResult);
    }
    
    const imageUrl = storageResult.url;
    
    // Build alt text using builder (safe to persist - generic, no business names)
    // Use ImageRequest fields directly, map platform enum
    const altText = buildAltText({
      platform: promptPlatform,
      category: imageRequest.category,
      aspect: aspect,
    });
    
    // Determine content type from mimeType
    const contentType = (mimeType as "image/png" | "image/jpeg" | "image/webp") || "image/png";
    
    // Build success result
    // NOTE: prompt and negativePrompt are NOT included in result
    const result = {
      requestId,
      ok: true,
      decision: decisionWithSafety as any,
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
        requestId,
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
      console.warn("[ImageEngine Regenerate API] DB persistence failed:", dbError);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ImageEngine Regenerate API] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 200 }
    );
  }
}

