/**
 * OBD Scheduler & Booking - Slots API Route (V4 Tier 1B)
 * 
 * GET: Get available booking slots for a date
 * Public endpoint (uses bookingKey for tenant resolution)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { validateBookingKeyFormat } from "@/lib/apps/obd-scheduler/bookingKey";
import { generateSlots } from "@/lib/apps/obd-scheduler/slots";
import { BookingStatus } from "@/lib/apps/obd-scheduler/types";
import type { Slot } from "@/lib/apps/obd-scheduler/slots";

export const runtime = "nodejs";

// Validation schema
const slotsQuerySchema = z.object({
  bookingKey: z.string().min(1, "Booking key is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  serviceId: z.string().optional(),
});

/**
 * GET /api/obd-scheduler/slots
 * Get available booking slots for a date
 */
export async function GET(request: NextRequest) {
  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const { searchParams } = new URL(request.url);
    const bookingKey = searchParams.get("bookingKey");
    const date = searchParams.get("date");
    const serviceId = searchParams.get("serviceId") || undefined;

    // Validate query parameters
    const parsed = slotsQuerySchema.safeParse({
      bookingKey,
      date,
      serviceId,
    });

    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const { bookingKey: validatedKey, date: targetDate, serviceId: validatedServiceId } = parsed.data;

    // Validate booking key format
    if (!validateBookingKeyFormat(validatedKey)) {
      return apiErrorResponse("Invalid booking key format", "VALIDATION_ERROR", 400);
    }

    // Find settings by bookingKey
    const settings = await prisma.bookingSettings.findUnique({
      where: { bookingKey: validatedKey },
      select: {
        businessId: true,
        bookingModeDefault: true,
        timezone: true,
        bufferMinutes: true,
        minNoticeHours: true,
        maxDaysOut: true,
      },
    });

    if (!settings) {
      return apiErrorResponse("Invalid booking key", "NOT_FOUND", 404);
    }

    // Check if instant booking is allowed
    if (settings.bookingModeDefault !== "INSTANT_ALLOWED") {
      return apiErrorResponse(
        "Instant booking is not enabled for this business",
        "INSTANT_BOOKING_DISABLED",
        403
      );
    }

    // Get service if provided
    let serviceDurationMinutes: number | undefined = undefined;
    if (validatedServiceId) {
      const service = await prisma.bookingService.findFirst({
        where: {
          id: validatedServiceId,
          businessId: settings.businessId,
          active: true,
        },
        select: {
          durationMinutes: true,
        },
      });

      if (!service) {
        return apiErrorResponse("Service not found or inactive", "INVALID_SERVICE", 400);
      }

      serviceDurationMinutes = service.durationMinutes;
    }

    // Get availability windows
    const windows = await prisma.availabilityWindow.findMany({
      where: { businessId: settings.businessId },
      orderBy: { dayOfWeek: "asc" },
    });

    // Get availability exceptions for the target date
    const exceptions = await prisma.availabilityException.findMany({
      where: {
        businessId: settings.businessId,
        date: new Date(targetDate),
      },
    });

    // Get existing bookings for the target date
    // We need to check bookings that might overlap with slots on this date
    const dateStart = new Date(`${targetDate}T00:00:00Z`);
    const dateEnd = new Date(`${targetDate}T23:59:59Z`);

    const existingBookings = await prisma.bookingRequest.findMany({
      where: {
        businessId: settings.businessId,
        OR: [
          // Bookings with proposed times on this date
          {
            proposedStart: {
              gte: dateStart,
              lte: dateEnd,
            },
          },
          // Bookings with preferred start on this date
          {
            preferredStart: {
              gte: dateStart,
              lte: dateEnd,
            },
          },
          // Bookings that span this date (start before, end after)
          {
            proposedStart: {
              lte: dateStart,
            },
            proposedEnd: {
              gte: dateEnd,
            },
          },
        ],
      },
      select: {
        id: true,
        status: true,
        preferredStart: true,
        proposedStart: true,
        proposedEnd: true,
        serviceId: true,
      },
    });

    // Format windows and exceptions for slot engine
    const formattedWindows = windows.map((w) => ({
      id: w.id,
      businessId: w.businessId,
      dayOfWeek: w.dayOfWeek,
      startTime: w.startTime,
      endTime: w.endTime,
      isEnabled: w.isEnabled,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    }));

    const formattedExceptions = exceptions.map((e) => ({
      id: e.id,
      businessId: e.businessId,
      date: e.date.toISOString().split("T")[0], // Convert to YYYY-MM-DD
      startTime: e.startTime,
      endTime: e.endTime,
      type: e.type,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));

    const formattedBookings = existingBookings.map((b) => ({
      id: b.id,
      businessId: settings.businessId,
      serviceId: b.serviceId,
      customerName: "",
      customerEmail: "",
      customerPhone: null,
      preferredStart: b.preferredStart?.toISOString() || null,
      preferredEnd: null,
      message: null,
      status: b.status as BookingStatus,
      proposedStart: b.proposedStart?.toISOString() || null,
      proposedEnd: b.proposedEnd?.toISOString() || null,
      internalNotes: null,
      createdAt: "",
      updatedAt: "",
    }));

    // Generate slots
    const slots = generateSlots({
      businessTimezone: settings.timezone,
      minNoticeHours: settings.minNoticeHours,
      maxDaysOut: settings.maxDaysOut,
      bufferMinutes: settings.bufferMinutes,
      availabilityWindows: formattedWindows,
      availabilityExceptions: formattedExceptions,
      existingBookings: formattedBookings,
      serviceDurationMinutes,
      targetDate,
    });

    return apiSuccessResponse({
      date: targetDate,
      slots,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

