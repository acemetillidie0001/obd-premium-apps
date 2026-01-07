/**
 * OBD Scheduler & Booking - Public Link API Route
 * 
 * GET: Get or create BookingPublicLink for current business
 * PUT: Update slug for BookingPublicLink
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { 
  ensureBookingPublicLink, 
  normalizeSlug, 
  validateSlug 
} from "@/lib/apps/obd-scheduler/bookingPublicLink";
import { z } from "zod";

export const runtime = "nodejs";

// Validation schema for slug update
const updateSlugSchema = z.object({
  slug: z.string().max(50).optional().nullable(),
});

/**
 * GET /api/obd-scheduler/public-link
 * Get or create BookingPublicLink for current business
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

    // Validate businessId
    const businessId = user.id; // V3: userId = businessId
    if (!businessId || typeof businessId !== "string") {
      return apiErrorResponse("Invalid business ID", "UNAUTHORIZED", 401);
    }

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    // Ensure link exists (creates if doesn't exist)
    // This should never fail for missing data - it creates automatically
    let publicLink;
    try {
      publicLink = await ensureBookingPublicLink(businessId);
    } catch (prismaError) {
      // Check if this is a real database error (connection, table missing, etc.)
      const errorMessage = prismaError instanceof Error ? prismaError.message.toLowerCase() : String(prismaError).toLowerCase();
      
      // If it's a connection/table error, return DATABASE_ERROR
      if (
        errorMessage.includes("connection") ||
        errorMessage.includes("relation") ||
        errorMessage.includes("does not exist") ||
        errorMessage.includes("p1001") ||
        errorMessage.includes("p2025")
      ) {
        console.error("[OBD Scheduler Public Link] Database error:", prismaError);
        return handleApiError(prismaError);
      }
      
      // For other errors, re-throw to be handled by outer catch
      throw prismaError;
    }

    return apiSuccessResponse({
      id: publicLink.id,
      businessId: publicLink.businessId,
      code: publicLink.code,
      slug: publicLink.slug,
      shortUrl: `https://apps.ocalabusinessdirectory.com/book/${publicLink.code}`,
      prettyUrl: publicLink.slug 
        ? `https://apps.ocalabusinessdirectory.com/book/${publicLink.slug}-${publicLink.code}`
        : null,
    });
  } catch (error) {
    // Log server-side for debugging
    console.error("[OBD Scheduler Public Link] Unexpected error:", error);
    
    // Only return 500 for real Prisma/database errors
    // Missing data is handled by ensureBookingPublicLink (creates if needed)
    return handleApiError(error);
  }
}

/**
 * PUT /api/obd-scheduler/public-link
 * Update slug for BookingPublicLink
 */
export async function PUT(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

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

    // Parse request body
    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request body
    const parsed = updateSlugSchema.safeParse(json);
    if (!parsed.success) {
      return apiErrorResponse(
        parsed.error.issues[0]?.message || "Invalid request",
        "VALIDATION_ERROR",
        400
      );
    }

    const { slug } = parsed.data;

    // Ensure link exists
    await ensureBookingPublicLink(businessId);

    // Normalize slug (null if empty/invalid)
    const normalizedSlug = slug ? normalizeSlug(slug) : null;

    // Validate slug if provided
    if (normalizedSlug && !validateSlug(normalizedSlug)) {
      return apiErrorResponse(
        "Slug must be 2-50 characters and contain only letters, numbers, and hyphens",
        "VALIDATION_ERROR",
        400
      );
    }

    // Check if slug is already taken by another business
    if (normalizedSlug) {
      const existing = await prisma.bookingPublicLink.findFirst({
        where: {
          slug: normalizedSlug,
          businessId: { not: businessId },
        },
        select: { id: true },
      });

      if (existing) {
        return apiErrorResponse(
          "This slug is already taken. Please choose a different one.",
          "VALIDATION_ERROR",
          400
        );
      }
    }

    // Update slug
    const updated = await prisma.bookingPublicLink.update({
      where: { businessId },
      data: { slug: normalizedSlug },
    });

    return apiSuccessResponse({
      id: updated.id,
      businessId: updated.businessId,
      code: updated.code,
      slug: updated.slug,
      shortUrl: `https://apps.ocalabusinessdirectory.com/book/${updated.code}`,
      prettyUrl: updated.slug 
        ? `https://apps.ocalabusinessdirectory.com/book/${updated.slug}-${updated.code}`
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

