/**
 * Widget Chat API Route
 * 
 * Public endpoint for widget chat requests.
 * Validates widget key and proxies to AnythingLLM.
 */

import { NextRequest } from "next/server";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { validateWidgetKey } from "@/lib/api/widgetAuth";
import { checkWidgetRateLimit } from "@/lib/api/widgetRateLimit";
import { getWorkspaceSlugForBusiness } from "@/lib/integrations/anythingllm/scoping";
import { chatWorkspace } from "@/lib/integrations/anythingllm/client";
import { z } from "zod";
import type { ChatRequest, ChatResponse } from "@/lib/apps/ai-help-desk/types";

export const runtime = "nodejs";

// Zod schema for request validation
const widgetChatRequestSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  key: z.string().min(1, "Widget key is required"),
  message: z.string().min(1, "Message is required").max(2000, "Message is too long"),
  threadId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = widgetChatRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId, key, message, threadId } = validationResult.data;

    // Validate widget key
    const isValid = await validateWidgetKey(businessId.trim(), key);
    if (!isValid) {
      return apiErrorResponse(
        "Invalid widget key",
        "UNAUTHORIZED",
        403
      );
    }

    // Check rate limit
    const rateLimitResponse = checkWidgetRateLimit(request, businessId.trim());
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get workspace slug for business
    const workspaceResult = await getWorkspaceSlugForBusiness(businessId.trim());
    const workspaceSlug = workspaceResult.workspaceSlug;

    // Perform chat via AnythingLLM
    const chatResponse = await chatWorkspace(workspaceSlug, message, threadId);

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

