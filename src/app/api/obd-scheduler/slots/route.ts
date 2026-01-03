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
import { getPrisma } from "@/lib/prisma";
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
    const prisma = getPrisma();
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
    let slots = generateSlots({
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

    // Optional: Filter slots by calendar free/busy if enabled
    // Fail open: if calendar check fails, show all slots
    let calendarWarning: string | null = null;
    try {
      const calendarConnection = await prisma.schedulerCalendarConnection.findFirst({
        where: {
          businessId: settings.businessId,
          enabled: true,
        },
        orderBy: {
          updatedAt: "desc", // Use most recently updated connection
        },
      });

      if (calendarConnection) {
        try {
          // Import calendar services dynamically to avoid circular dependencies
          const { getGoogleAccessToken, getGoogleFreeBusy } = await import("@/lib/apps/obd-scheduler/calendar/google");
          const { getMicrosoftAccessToken, getMicrosoftFreeBusy } = await import("@/lib/apps/obd-scheduler/calendar/microsoft");

          const timeMin = new Date(`${targetDate}T00:00:00Z`).toISOString();
          const timeMax = new Date(`${targetDate}T23:59:59Z`).toISOString();

          let busyIntervals: Array<{ start: string; end: string }> = [];
          
          if (calendarConnection.provider === "google") {
            const accessToken = await getGoogleAccessToken(settings.businessId);
            busyIntervals = await getGoogleFreeBusy(accessToken, timeMin, timeMax);
          } else if (calendarConnection.provider === "microsoft") {
            const accessToken = await getMicrosoftAccessToken(settings.businessId);
            busyIntervals = await getMicrosoftFreeBusy(accessToken, timeMin, timeMax);
          }

          // Filter out slots that overlap with busy intervals
          if (busyIntervals.length > 0) {
            slots = slots.filter((slot) => {
              const slotStart = new Date(slot.startTime);
              const slotEnd = new Date(slotStart.getTime() + (serviceDurationMinutes || 60) * 60 * 1000);

              // Check if slot overlaps with any busy interval
              return !busyIntervals.some((busy) => {
                const busyStart = new Date(busy.start);
                const busyEnd = new Date(busy.end);
                
                // Overlap check: slot overlaps if it starts before busy ends and ends after busy starts
                return slotStart < busyEnd && slotEnd > busyStart;
              });
            });
          }
        } catch (calendarError) {
          // Fail open: log error but don't block slots
          console.error("Calendar freebusy check failed:", calendarError);
          calendarWarning = "Calendar availability temporarily unavailable";
        }
      }
    } catch (error) {
      // Fail open: ignore calendar errors
      console.error("Calendar connection check failed:", error);
    }

    return apiSuccessResponse({
      date: targetDate,
      slots,
      calendarWarning, // Include warning if calendar check failed
    });
  } catch (error) {
    return handleApiError(error);
  }
}

