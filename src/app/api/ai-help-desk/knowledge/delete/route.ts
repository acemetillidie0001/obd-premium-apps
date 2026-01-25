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
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
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

  warnIfBusinessIdParamPresent(request);

  try {
    const { businessId, role, userId } = await requireTenant();
    void role;
    void userId;
    // Prefer DELETE if present in matrix; fallback to EDIT_DRAFT is acceptable per instructions.
    await requirePermission("AI_HELP_DESK", "DELETE");

    // Parse and validate request body
    const body = await request.json();
    const validationResult = deleteRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { id } = validationResult.data;

    // Delete only within this business
    const result = await prisma.aiHelpDeskEntry.deleteMany({
      where: { id, businessId },
    });

    if (result.count <= 0) {
      return apiErrorResponse("Entry not found", "UPSTREAM_NOT_FOUND", 404);
    }

    return apiSuccessResponse({
      success: true,
      id,
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

