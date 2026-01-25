/**
 * Widget Key Rotation API Route
 * 
 * Rotates the widget key for a business.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { rotateWidgetKey } from "@/lib/api/widgetAuth";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { z } from "zod";

export const runtime = "nodejs";

// Zod schema for request validation
const rotateKeySchema = z.object({
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
    await requirePermission("AI_HELP_DESK", "MANAGE_SETTINGS");

    // Parse and validate request body
    const body = await request.json();
    const validationResult = rotateKeySchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    // Rotate key
    const newKey = await rotateWidgetKey(businessId);

    return apiSuccessResponse({
      publicKey: newKey,
      message: "Widget key rotated successfully",
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

