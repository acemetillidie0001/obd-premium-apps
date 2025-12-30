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
import { z } from "zod";

export const runtime = "nodejs";

// Zod schema for request validation
const rotateKeySchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
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
    const validationResult = rotateKeySchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId } = validationResult.data;

    // Tenant safety: Ensure businessId is provided
    if (!businessId || !businessId.trim()) {
      return apiErrorResponse(
        "Business ID is required",
        "BUSINESS_REQUIRED",
        400
      );
    }

    // Rotate key
    const newKey = await rotateWidgetKey(businessId.trim());

    return apiSuccessResponse({
      publicKey: newKey,
      message: "Widget key rotated successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

