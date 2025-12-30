/**
 * Widget Settings API Route
 * 
 * GET: Retrieve widget settings
 * POST: Update widget settings
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { getOrCreateWidgetKey } from "@/lib/api/widgetAuth";
import { z } from "zod";

export const runtime = "nodejs";

// Zod schema for POST request validation
const widgetSettingsSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  enabled: z.boolean().optional(),
  brandColor: z.string().optional(),
  greeting: z.string().max(200).optional(),
  position: z.enum(["bottom-right", "bottom-left"]).optional(),
  assistantAvatarUrl: z.string().url("Invalid avatar URL").optional().nullable(),
});

// GET: Retrieve widget settings
export async function GET(request: NextRequest) {
  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return validationErrorResponse(
        new z.ZodError([
          {
            code: "custom",
            path: ["businessId"],
            message: "businessId query parameter is required",
          },
        ])
      );
    }

    // Get or create widget key
    const publicKey = await getOrCreateWidgetKey(businessId);

    // Get widget settings
    let settings = await prisma.aiHelpDeskWidgetSettings.findUnique({
      where: { businessId },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.aiHelpDeskWidgetSettings.create({
        data: {
          businessId,
          enabled: false,
          brandColor: "#29c4a9",
          greeting: "Hi! How can I help you today?",
          position: "bottom-right",
        },
      });
    }

    return apiSuccessResponse({
      ...settings,
      publicKey, // Include public key in response
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST: Update widget settings
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
    const validationResult = widgetSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId, enabled, brandColor, greeting, position, assistantAvatarUrl } = validationResult.data;

    // Tenant safety: Ensure businessId is provided
    if (!businessId || !businessId.trim()) {
      return apiErrorResponse(
        "Business ID is required",
        "BUSINESS_REQUIRED",
        400
      );
    }

    // Get or create widget key
    const publicKey = await getOrCreateWidgetKey(businessId.trim());

    // Upsert settings
    const settings = await prisma.aiHelpDeskWidgetSettings.upsert({
      where: { businessId: businessId.trim() },
      update: {
        ...(enabled !== undefined && { enabled }),
        ...(brandColor !== undefined && { brandColor }),
        ...(greeting !== undefined && { greeting }),
        ...(position !== undefined && { position }),
        ...(assistantAvatarUrl !== undefined && { assistantAvatarUrl: assistantAvatarUrl || null }),
        updatedAt: new Date(),
      },
      create: {
        businessId: businessId.trim(),
        enabled: enabled ?? false,
        brandColor: brandColor ?? "#29c4a9",
        greeting: greeting ?? "Hi! How can I help you today?",
        position: position ?? "bottom-right",
        assistantAvatarUrl: assistantAvatarUrl || null,
      },
    });

    return apiSuccessResponse({
      ...settings,
      publicKey,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

