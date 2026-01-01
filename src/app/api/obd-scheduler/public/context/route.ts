/**
 * OBD Scheduler & Booking - Public Context API Route (V3)
 * 
 * GET: Get business context by bookingKey (for public booking form)
 * This endpoint is public (no authentication required) but validates bookingKey.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { validateBookingKeyFormat } from "@/lib/apps/obd-scheduler/bookingKey";

export const runtime = "nodejs";

/**
 * GET /api/obd-scheduler/public/context
 * Get business context by bookingKey
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // Accept both 'key' and 'bookingKey' query params for flexibility
    const bookingKey = searchParams.get("key") || searchParams.get("bookingKey");

    if (!bookingKey) {
      return apiErrorResponse("Booking key is required", "VALIDATION_ERROR", 400);
    }

    // Validate booking key format
    if (!validateBookingKeyFormat(bookingKey)) {
      return apiErrorResponse("Invalid booking key format", "VALIDATION_ERROR", 400);
    }

    // Find settings by bookingKey
    const settings = await prisma.bookingSettings.findUnique({
      where: { bookingKey },
      select: {
        businessId: true,
        bookingModeDefault: true,
        timezone: true,
        bufferMinutes: true,
        minNoticeHours: true,
        maxDaysOut: true,
        policyText: true,
      },
    });

    if (!settings) {
      return apiErrorResponse("Invalid booking key", "NOT_FOUND", 404);
    }

    // Get active services for this business
    const services = await prisma.bookingService.findMany({
      where: {
        businessId: settings.businessId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        description: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Get business name from BrandProfile and logo from BookingTheme
    // These are optional - missing records should not cause errors
    let businessName: string | null = null;
    let logoUrl: string | null = null;

    try {
      const [brandProfile, bookingTheme] = await Promise.all([
        prisma.brandProfile.findUnique({
          where: { userId: settings.businessId },
          select: { businessName: true },
        }).catch(() => null),
        prisma.bookingTheme.findUnique({
          where: { businessId: settings.businessId },
          select: { logoUrl: true },
        }).catch(() => null),
      ]);

      businessName = brandProfile?.businessName || null;
      logoUrl = bookingTheme?.logoUrl || null;
    } catch (lookupError) {
      // If optional lookups fail, continue with null values
      // This prevents crashes when BrandProfile or BookingTheme are missing
      console.warn("[Public Context] Optional business data lookup failed:", lookupError);
    }

    return apiSuccessResponse({
      businessId: settings.businessId,
      bookingModeDefault: settings.bookingModeDefault,
      timezone: settings.timezone,
      bufferMinutes: settings.bufferMinutes,
      minNoticeHours: settings.minNoticeHours,
      maxDaysOut: settings.maxDaysOut,
      policyText: settings.policyText,
      services: Array.isArray(services) ? services : [],
      businessName,
      logoUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

