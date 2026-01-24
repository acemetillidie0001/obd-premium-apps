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
import { BusinessContextError, requireBusinessContext } from "@/lib/auth/requireBusinessContext";
import { z } from "zod";

export const runtime = "nodejs";

// Zod schema for POST request validation
const widgetSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  brandColor: z.string().optional(),
  greeting: z.string().max(200).optional(),
  position: z.enum(["bottom-right", "bottom-left"]).optional(),
  assistantAvatarUrl: z.string().url("Invalid avatar URL").optional().nullable(),
  allowedDomains: z.array(z.string()).optional(),
});

// GET: Retrieve widget settings
export async function GET(request: NextRequest) {
  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    let businessId: string;
    try {
      const ctx = await requireBusinessContext();
      businessId = ctx.businessId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (err instanceof BusinessContextError) {
        const code = err.status === 401 ? "UNAUTHORIZED" : err.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
        return apiErrorResponse(msg, code, err.status);
      }
      return apiErrorResponse(msg, "UNAUTHORIZED", 401);
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
    let businessId: string;
    try {
      const ctx = await requireBusinessContext();
      businessId = ctx.businessId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (err instanceof BusinessContextError) {
        const code = err.status === 401 ? "UNAUTHORIZED" : err.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
        return apiErrorResponse(msg, code, err.status);
      }
      return apiErrorResponse(msg, "UNAUTHORIZED", 401);
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = widgetSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { enabled, brandColor, greeting, position, assistantAvatarUrl, allowedDomains } = validationResult.data;

    // Get or create widget key
    const publicKey = await getOrCreateWidgetKey(businessId);

    // Upsert settings
    const settings = await prisma.aiHelpDeskWidgetSettings.upsert({
      where: { businessId },
      update: {
        ...(enabled !== undefined && { enabled }),
        ...(brandColor !== undefined && { brandColor }),
        ...(greeting !== undefined && { greeting }),
        ...(position !== undefined && { position }),
        ...(assistantAvatarUrl !== undefined && { assistantAvatarUrl: assistantAvatarUrl || null }),
        ...(allowedDomains !== undefined && { allowedDomains: allowedDomains || [] } as any),
        updatedAt: new Date(),
      },
      create: {
        businessId,
        enabled: enabled ?? false,
        brandColor: brandColor ?? "#29c4a9",
        greeting: greeting ?? "Hi! How can I help you today?",
        position: position ?? "bottom-right",
        assistantAvatarUrl: assistantAvatarUrl || null,
        allowedDomains: (allowedDomains || []) as any,
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

