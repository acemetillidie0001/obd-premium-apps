/**
 * AI Help Desk Setup Test API Route
 * 
 * Tests the connection to AnythingLLM for a given business/workspace.
 * Performs both search and chat tests to validate the integration.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getWorkspaceSlugForBusiness } from "@/lib/integrations/anythingllm/scoping";
import { searchWorkspace, chatWorkspace } from "@/lib/integrations/anythingllm/client";
import { z } from "zod";

export const runtime = "nodejs";

// Zod schema for request validation
const testRequestSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  query: z.string().max(200).optional().default("hours"),
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
    const validationResult = testRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId, query } = validationResult.data;

    // Get workspace slug for business (includes fallback in dev)
    const workspaceResult = await getWorkspaceSlugForBusiness(businessId);
    const workspaceSlug = workspaceResult.workspaceSlug;
    const isFallback = workspaceResult.isFallback;

    // Test search
    let searchOk = false;
    let searchResultsCount = 0;
    let searchError: string | null = null;

    try {
      const searchResults = await searchWorkspace(workspaceSlug, query || "hours", 5);
      searchOk = true;
      searchResultsCount = searchResults.results?.length || 0;
    } catch (error) {
      searchError = error instanceof Error ? error.message : String(error);
      // Check if it's a "not found" type error
      if (
        searchError.includes("404") ||
        searchError.includes("not found") ||
        searchError.includes("workspace")
      ) {
        return apiErrorResponse(
          `Workspace "${workspaceSlug}" not found in AnythingLLM. Please verify the workspace slug is correct.`,
          "UPSTREAM_NOT_FOUND",
          404,
          {
            workspaceSlug,
            friendlyMessage:
              "The workspace doesn't exist in your AnythingLLM instance. Please check the workspace slug and ensure it exists in AnythingLLM.",
          }
        );
      }
    }

    // Test chat
    let chatOk = false;
    let chatAnswerPreview = "";
    let sourcesCount = 0;
    let chatError: string | null = null;

    try {
      const chatResponse = await chatWorkspace(
        workspaceSlug,
        "Say 'OK' and list any sources if available."
      );
      chatOk = true;
      chatAnswerPreview = chatResponse.answer?.substring(0, 200) || "";
      sourcesCount = chatResponse.sources?.length || 0;
    } catch (error) {
      chatError = error instanceof Error ? error.message : String(error);
      // Check if it's a "not found" type error
      if (
        chatError.includes("404") ||
        chatError.includes("not found") ||
        chatError.includes("workspace")
      ) {
        return apiErrorResponse(
          `Workspace "${workspaceSlug}" not found in AnythingLLM. Please verify the workspace slug is correct.`,
          "UPSTREAM_NOT_FOUND",
          404,
          {
            workspaceSlug,
            friendlyMessage:
              "The workspace doesn't exist in your AnythingLLM instance. Please check the workspace slug and ensure it exists in AnythingLLM.",
          }
        );
      }
    }

    // Return test results
    return apiSuccessResponse({
      searchOk,
      chatOk,
      workspaceSlug,
      isFallback,
      searchResultsCount,
      chatAnswerPreview,
      sourcesCount,
      searchError: searchError || null,
      chatError: chatError || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

