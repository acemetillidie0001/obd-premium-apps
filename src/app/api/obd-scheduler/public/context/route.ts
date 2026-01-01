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
    const bookingKey = searchParams.get("key");

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
    const [brandProfile, bookingTheme] = await Promise.all([
      prisma.brandProfile.findUnique({
        where: { userId: settings.businessId },
        select: { businessName: true },
      }),
      prisma.bookingTheme.findUnique({
        where: { businessId: settings.businessId },
        select: { logoUrl: true },
      }),
    ]);

    return apiSuccessResponse({
      businessId: settings.businessId,
      bookingModeDefault: settings.bookingModeDefault,
      timezone: settings.timezone,
      bufferMinutes: settings.bufferMinutes,
      minNoticeHours: settings.minNoticeHours,
      maxDaysOut: settings.maxDaysOut,
      policyText: settings.policyText,
      services,
      businessName: brandProfile?.businessName || null,
      logoUrl: bookingTheme?.logoUrl || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

