/**
 * OBD Scheduler & Booking - Theme API Route (V4 Tier 1A)
 * 
 * GET: Get booking theme settings
 * PUT: Update booking theme settings
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { z } from "zod";
import type {
  BookingTheme,
  UpdateBookingThemeRequest,
} from "@/lib/apps/obd-scheduler/types";

export const runtime = "nodejs";

// Validation schema
const updateThemeSchema = z.object({
  logoUrl: z.string().url("Invalid logo URL").optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Primary color must be a valid hex color (e.g., #29c4a9)").optional().nullable(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Accent color must be a valid hex color").optional().nullable(),
  headlineText: z.string().max(200).optional().nullable(),
  introText: z.string().max(1000).optional().nullable(),
});

// Helper: Format theme from DB
function formatTheme(theme: any): BookingTheme {
  return {
    id: theme.id,
    businessId: theme.businessId,
    logoUrl: theme.logoUrl,
    primaryColor: theme.primaryColor,
    accentColor: theme.accentColor,
    headlineText: theme.headlineText,
    introText: theme.introText,
    createdAt: theme.createdAt.toISOString(),
    updatedAt: theme.updatedAt.toISOString(),
  };
}

/**
 * GET /api/obd-scheduler/theme
 * Get booking theme settings (creates default if not exists)
 */
export async function GET(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const prisma = getPrisma();
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    // Get or create theme
    let theme = await prisma.bookingTheme.findUnique({
      where: { businessId },
    });

    if (!theme) {
      // Create default theme
      theme = await prisma.bookingTheme.create({
        data: {
          businessId,
          primaryColor: "#29c4a9",
        },
      });
    }

    return apiSuccessResponse(formatTheme(theme));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/obd-scheduler/theme
 * Update booking theme settings
 */
export async function PUT(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const prisma = getPrisma();
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request body
    const parsed = updateThemeSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // Get existing theme or create new
    const existing = await prisma.bookingTheme.findUnique({
      where: { businessId },
    });

    const updateData: any = {};

    if (body.logoUrl !== undefined) {
      updateData.logoUrl = body.logoUrl?.trim() || null;
    }

    if (body.primaryColor !== undefined) {
      updateData.primaryColor = body.primaryColor || null;
    }

    if (body.accentColor !== undefined) {
      updateData.accentColor = body.accentColor || null;
    }

    if (body.headlineText !== undefined) {
      updateData.headlineText = body.headlineText?.trim() || null;
    }

    if (body.introText !== undefined) {
      updateData.introText = body.introText?.trim() || null;
    }

    let theme: any;

    if (existing) {
      // Update existing
      theme = await prisma.bookingTheme.update({
        where: { businessId },
        data: updateData,
      });
    } else {
      // Create new with defaults
      theme = await prisma.bookingTheme.create({
        data: {
          businessId,
          logoUrl: body.logoUrl?.trim() || null,
          primaryColor: body.primaryColor || "#29c4a9",
          accentColor: body.accentColor || null,
          headlineText: body.headlineText?.trim() || null,
          introText: body.introText?.trim() || null,
        },
      });
    }

    return apiSuccessResponse(formatTheme(theme));
  } catch (error) {
    return handleApiError(error);
  }
}

