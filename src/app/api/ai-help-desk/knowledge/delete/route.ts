/**
 * AI Help Desk Knowledge Delete API Route
 * 
 * Handles deleting knowledge entries for a business.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

// Zod schema for request validation
const deleteRequestSchema = z.object({
  id: z.string().min(1, "Entry ID is required"),
  businessId: z.string().min(1, "Business ID is required"),
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
    const validationResult = deleteRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { id, businessId } = validationResult.data;

    // Tenant safety: Ensure businessId is provided
    if (!businessId || !businessId.trim()) {
      return apiErrorResponse(
        "Business ID is required",
        "BUSINESS_REQUIRED",
        400
      );
    }

    const trimmedBusinessId = businessId.trim();

    // Verify the entry exists and belongs to the business (tenant safety)
    const existing = await prisma.aiHelpDeskEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      return apiErrorResponse(
        "Entry not found",
        "UPSTREAM_NOT_FOUND",
        404
      );
    }

    // Ensure tenant safety: entry must belong to the same business
    if (existing.businessId !== trimmedBusinessId) {
      return apiErrorResponse(
        "Entry does not belong to this business",
        "TENANT_SAFETY_BLOCKED",
        403
      );
    }

    // Delete entry
    await prisma.aiHelpDeskEntry.delete({
      where: { id },
    });

    return apiSuccessResponse({
      success: true,
      id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

