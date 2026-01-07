/**
 * AI Help Desk Chat API Route
 * 
 * Handles chat messages for business knowledge bases via AnythingLLM.
 * Supports conversation threads for continuity.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getWorkspaceSlugForBusiness } from "@/lib/integrations/anythingllm/scoping";
import { chatWorkspace } from "@/lib/integrations/anythingllm/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { ChatRequest, ChatResponse } from "@/lib/apps/ai-help-desk/types";

export const runtime = "nodejs";

// Zod schema for request validation
const chatRequestSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  message: z.string().min(1, "Message is required").max(2000, "Message is too long"),
  threadId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = chatRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId, message, threadId } = validationResult.data as ChatRequest;

    // Tenant safety: Ensure businessId is provided (validation should catch this, but double-check for safety)
    if (!businessId || !businessId.trim()) {
      return apiErrorResponse(
        "Business ID is required",
        "BUSINESS_REQUIRED",
        400
      );
    }

    // Get workspace slug for business (includes fallback in dev, but requires mapping in production)
    const workspaceResult = await getWorkspaceSlugForBusiness(businessId.trim());
    const workspaceSlug = workspaceResult.workspaceSlug;

    // Perform chat via AnythingLLM
    const chatResponse = await chatWorkspace(workspaceSlug, message, threadId);

    // Handle low confidence / no sources case
    if (!chatResponse.sources || chatResponse.sources.length === 0) {
      // Still return the answer, but note that sources are empty
      // The UI can handle this with a friendly message
    }

    // Log the question for insights (async, don't block response)
    const sourcesCount = chatResponse.sources?.length || 0;
    const hasSources = sourcesCount > 0;
    
    // Determine response quality
    let responseQuality: "GOOD" | "WEAK" | "NONE" | null = null;
    if (sourcesCount >= 2) {
      responseQuality = "GOOD";
    } else if (sourcesCount === 1) {
      responseQuality = "WEAK";
    } else {
      responseQuality = "NONE";
    }

    // Extract matched entry IDs from sources (if they have IDs)
    const matchedEntryIds = chatResponse.sources
      ?.map((source) => source.id)
      .filter((id): id is string => Boolean(id)) || [];

    // Log question asynchronously (don't await to avoid blocking response)
    // NOTE: aiHelpDeskQuestionLog model removed from schema - table doesn't exist in production DB
    // TODO: Re-enable when AiHelpDeskQuestionLog table is added to production database
    // prisma.aiHelpDeskQuestionLog
    //   .create({
    //     data: {
    //       businessId: businessId.trim(),
    //       question: message.trim(),
    //       hasSources,
    //       sourcesCount,
    //       responseQuality,
    //       matchedEntryIds,
    //     },
    //   })
    //   .catch((error) => {
    //     // Log error but don't fail the request
    //     // Use structured logging if available, otherwise console.error is acceptable for async failures
    //     if (process.env.NODE_ENV === "development") {
    //       console.error("Failed to log question for insights:", error);
    //     }
    //     // In production, consider using apiLogger if available
    //   });

    // Return normalized response
    const response: ChatResponse = {
      ok: true,
      data: {
        threadId: chatResponse.threadId,
        answer: chatResponse.answer,
        sources: chatResponse.sources,
      },
    };

    return apiSuccessResponse(response.data);

  } catch (error) {
    return handleApiError(error);
  }
}

