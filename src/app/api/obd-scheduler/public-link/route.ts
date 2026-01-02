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
import { prisma } from "@/lib/prisma";
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
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    // Ensure link exists (creates if doesn't exist)
    const publicLink = await ensureBookingPublicLink(businessId);

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
    return handleApiError(error);
  }
}

/**
 * PUT /api/obd-scheduler/public-link
 * Update slug for BookingPublicLink
 */
export async function PUT(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

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

