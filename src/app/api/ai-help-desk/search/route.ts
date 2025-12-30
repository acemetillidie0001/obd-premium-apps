/**
 * AI Help Desk Search API Route
 * 
 * Handles search requests for business knowledge bases via AnythingLLM.
 * Requires businessId and query. Returns normalized search results.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getWorkspaceSlugForBusiness } from "@/lib/integrations/anythingllm/scoping";
import { searchWorkspace } from "@/lib/integrations/anythingllm/client";
import { z } from "zod";
import type { SearchRequest, SearchResponse } from "@/lib/apps/ai-help-desk/types";

export const runtime = "nodejs";

// Zod schema for request validation
const searchRequestSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  query: z.string().min(1, "Query is required").max(500, "Query is too long"),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export async function POST(request: NextRequest) {
  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = searchRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId, query, limit } = validationResult.data as SearchRequest;

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

    // Perform search via AnythingLLM
    const searchResults = await searchWorkspace(workspaceSlug, query, limit);

    // Return normalized response
    const response: SearchResponse = {
      ok: true,
      data: {
        results: searchResults.results,
      },
    };

    return apiSuccessResponse(response.data);

  } catch (error) {
    return handleApiError(error);
  }
}

