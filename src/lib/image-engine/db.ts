/**
 * OBD Brand-Safe Image Generator - Database Helpers
 * 
 * Minimal server-side helpers for persisting ImageRequest and ImageEvent records.
 * No prompts stored, only safe hashes and decision JSON.
 */

import { prisma } from "@/lib/prisma";
import type { ImageGenerationResult } from "./types";

/**
 * Upserts an ImageRequest from a generation result.
 * 
 * @param result - The ImageGenerationResult from ImageEngine.generate()
 * @param storageName - Optional storage backend name (e.g., "local_dev", "vercel_blob", "remote_stub")
 * @returns The created or updated ImageRequest record
 */
export async function upsertImageRequestFromResult(
  result: ImageGenerationResult,
  storageName?: "local_dev" | "vercel_blob" | "remote_stub"
) {
  const { requestId, ok, decision, image, fallback, error } = result;

  // Map platform from TypeScript type to Prisma enum
  const platformMap: Record<string, "instagram" | "facebook" | "x" | "gbp"> = {
    instagram: "instagram",
    facebook: "facebook",
    x: "x",
    google_business_profile: "gbp",
    blog: "gbp", // Default blog to gbp
  };

  // Map category from TypeScript type to Prisma enum
  const categoryMap: Record<string, "educational" | "promotion" | "social_proof" | "local_abstract" | "evergreen"> = {
    educational: "educational",
    promotion: "promotion",
    social_proof: "social_proof",
    local_abstract: "local_abstract",
    evergreen: "evergreen",
  };

  const platform = platformMap[decision.platform] || "gbp";
  const category = categoryMap[decision.category] || "evergreen";

  // Determine status
  let status: "queued" | "generated" | "fallback" | "failed" | "skipped" = "queued";
  if (ok && image) {
    status = "generated";
  } else if (error?.code === "SAFETY_BLOCKED") {
    status = "skipped";
  } else if (fallback?.used) {
    status = "fallback";
  } else if (error) {
    status = "failed";
  }

  // Resolve size from decision
  const { width, height } = resolveSize(decision.platform, decision.aspect);

  // Extract provider and storage from decision (if available)
  const provider = decision.providerPlan.providerId === "nano_banana" ? "nanoBananaFlash" : null;
  
  // Map storage name to Prisma enum
  let storage: "localDev" | "vercelBlob" | null = null;
  if (storageName === "local_dev") {
    storage = "localDev";
  } else if (storageName === "vercel_blob") {
    storage = "vercelBlob";
  } else if (storageName === "remote_stub") {
    // remote_stub is legacy, map to null
    storage = null;
  }

  // Prepare decision JSON (safe, no prompts)
  const decisionJson: any = {
    mode: decision.mode,
    platform: decision.platform,
    aspect: decision.aspect,
    category: decision.category,
    energy: decision.energy,
    text: {
      allowance: decision.text.allowance,
      recommendedOverlayText: decision.text.recommendedOverlayText,
    },
    safety: {
      isAllowed: decision.safety.isAllowed,
      reasons: decision.safety.reasons,
      usedFallback: decision.safety.usedFallback,
    },
    promptPlan: {
      templateId: decision.promptPlan.templateId,
      negativeRules: decision.promptPlan.negativeRules,
      // Variables are safe (no prompt text)
      variables: decision.promptPlan.variables,
    },
    providerPlan: {
      providerId: decision.providerPlan.providerId,
      modelTier: decision.providerPlan.modelTier,
      notes: decision.providerPlan.notes,
    },
  };

  // Include safety rules result if present (from safety rules engine)
  if ((decision as any).safetyResult) {
    decisionJson.safetyRules = {
      verdict: (decision as any).safetyResult.verdict,
      reasonSafe: (decision as any).safetyResult.reasonSafe,
      tags: (decision as any).safetyResult.tags || [],
    };
  }

  return await prisma.imageRequest.upsert({
    where: { requestId },
    create: {
      requestId,
      status,
      platform,
      category,
      aspect: decision.aspect,
      width,
      height,
      provider: provider as "nanoBananaFlash" | "stub" | null,
      storage: storage as "localDev" | "vercelBlob" | null,
      imageUrl: image?.url || null,
      altText: image?.altText || null,
      errorCode: error?.code || null,
      errorMessageSafe: error?.message || null,
      fallbackReason: fallback?.reason || null,
      decisionJson: decisionJson as any, // Prisma Json type
      promptHash: null, // Will be set by caller if needed
      inputHash: null, // Will be set by caller if needed
    },
    update: {
      status,
      imageUrl: image?.url || null,
      altText: image?.altText || null,
      errorCode: error?.code || null,
      errorMessageSafe: error?.message || null,
      fallbackReason: fallback?.reason || null,
      decisionJson: decisionJson as any,
      updatedAt: new Date(),
    },
  });
}

/**
 * Logs an ImageEvent for audit/debug purposes.
 * 
 * @param requestId - The ImageRequest requestId
 * @param type - Event type (e.g., "provider_call", "storage_write", "fallback", "consumer_request")
 * @param ok - Whether the event succeeded
 * @param messageSafe - Optional safe message (no PII, no prompts)
 * @param data - Optional JSON data (safe, no prompts)
 * @returns The created ImageEvent record
 */
export async function logImageEvent(
  requestId: string,
  type: string,
  ok: boolean,
  messageSafe?: string | null,
  data?: Record<string, unknown> | null
) {
  return await prisma.imageEvent.create({
    data: {
      requestId,
      type,
      ok,
      messageSafe: messageSafe || null,
      data: data ? (data as any) : null, // Prisma Json type
    },
  });
}

/**
 * Resolves image dimensions from platform and aspect.
 * Matches the logic in src/lib/image-engine/size.ts
 */
function resolveSize(
  platform: string,
  aspect: string
): { width: number; height: number } {
  const aspectMap: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "4:5": { width: 1024, height: 1280 },
    "16:9": { width: 1920, height: 1080 },
    "4:3": { width: 1280, height: 960 },
  };

  return aspectMap[aspect] || { width: 1024, height: 1024 };
}

