/**
 * OBD Scheduler & Booking - Instant Booking API Route (V4 Tier 1B)
 * 
 * POST: Create an instant booking (approved immediately)
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
import { syncBookingToCrm } from "@/lib/apps/obd-scheduler/integrations/crm";
import { Prisma, BookingStatus } from "@prisma/client";
import { BookingStatus as TypesBookingStatus } from "@/lib/apps/obd-scheduler/types";

export const runtime = "nodejs";

// Validation schema
const instantBookingSchema = z.object({
  bookingKey: z.string().min(1, "Booking key is required"),
  customerName: z.string().min(1, "Customer name is required").max(200),
  customerEmail: z.string().email("Invalid email format"),
  customerPhone: z.string().max(50).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  serviceId: z.string().optional().nullable(),
  startTime: z.string().datetime("Invalid start time format"), // ISO 8601
});

/**
 * POST /api/obd-scheduler/bookings/instant
 * Create an instant booking
 */
export async function POST(request: NextRequest) {
  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request body
    const parsed = instantBookingSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // Validate booking key format
    if (!validateBookingKeyFormat(body.bookingKey)) {
      return apiErrorResponse("Invalid booking key format", "VALIDATION_ERROR", 400);
    }

    // Find settings by bookingKey
    const settings = await prisma.bookingSettings.findUnique({
      where: { bookingKey: body.bookingKey },
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

    // Parse and validate start time
    const startTime = new Date(body.startTime);
    if (isNaN(startTime.getTime())) {
      return apiErrorResponse("Invalid start time", "VALIDATION_ERROR", 400);
    }

    // Normalize start time to 15-minute increments
    const minutes = startTime.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    if (roundedMinutes >= 60) {
      startTime.setHours(startTime.getHours() + 1);
      startTime.setMinutes(0);
    } else {
      startTime.setMinutes(roundedMinutes);
    }
    startTime.setSeconds(0);
    startTime.setMilliseconds(0);

    const targetDate = startTime.toISOString().split("T")[0]; // YYYY-MM-DD

    // Get service if provided
    let serviceDurationMinutes: number | undefined = undefined;
    let service: any = null;

    if (body.serviceId) {
      service = await prisma.bookingService.findFirst({
        where: {
          id: body.serviceId,
          businessId: settings.businessId,
          active: true,
        },
      });

      if (!service) {
        return apiErrorResponse("Service not found or inactive", "INVALID_SERVICE", 400);
      }

      serviceDurationMinutes = service.durationMinutes;
    } else {
      // Default to 60 minutes if no service
      serviceDurationMinutes = 60;
    }

    // Calculate end time
    const durationMinutes = serviceDurationMinutes ?? 60;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

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

    // Get existing bookings for the target date (including this one if it exists)
    const dateStart = new Date(`${targetDate}T00:00:00Z`);
    const dateEnd = new Date(`${targetDate}T23:59:59Z`);

    const existingBookings = await prisma.bookingRequest.findMany({
      where: {
        businessId: settings.businessId,
        OR: [
          {
            proposedStart: {
              gte: dateStart,
              lte: dateEnd,
            },
          },
          {
            preferredStart: {
              gte: dateStart,
              lte: dateEnd,
            },
          },
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

    // Format data for slot generation
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
      date: e.date.toISOString().split("T")[0],
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
      status: b.status as TypesBookingStatus,
      proposedStart: b.proposedStart?.toISOString() || null,
      proposedEnd: b.proposedEnd?.toISOString() || null,
      internalNotes: null,
      createdAt: "",
      updatedAt: "",
    }));

    // Recompute slots to verify availability
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

    // Check if requested start time is in available slots
    const requestedSlotISO = startTime.toISOString();
    const isAvailable = slots.some((slot) => slot.startTime === requestedSlotISO);

    if (!isAvailable) {
      return apiErrorResponse(
        "The selected time slot is no longer available. Please choose another time.",
        "SLOT_UNAVAILABLE",
        409
      );
    }

    // Create booking with APPROVED status
    const bookingRequest = await prisma.bookingRequest.create({
      data: {
        businessId: settings.businessId,
        serviceId: body.serviceId || null,
        customerName: body.customerName.trim(),
        customerEmail: body.customerEmail.trim().toLowerCase(),
        customerPhone: body.customerPhone?.trim() || null,
        preferredStart: startTime,
        preferredEnd: null, // Not used for instant bookings
        proposedStart: startTime,
        proposedEnd: endTime,
        message: body.message?.trim() || null,
        status: BookingStatus.APPROVED,
      },
      include: {
        service: true,
      },
    });

    // Format response
    const formatted = {
      id: bookingRequest.id,
      businessId: bookingRequest.businessId,
      serviceId: bookingRequest.serviceId,
      customerName: bookingRequest.customerName,
      customerEmail: bookingRequest.customerEmail,
      customerPhone: bookingRequest.customerPhone,
      preferredStart: bookingRequest.preferredStart?.toISOString() || null,
      preferredEnd: bookingRequest.preferredEnd?.toISOString() || null,
      message: bookingRequest.message,
      status: bookingRequest.status as TypesBookingStatus,
      proposedStart: bookingRequest.proposedStart?.toISOString() || null,
      proposedEnd: bookingRequest.proposedEnd?.toISOString() || null,
      internalNotes: bookingRequest.internalNotes,
      createdAt: bookingRequest.createdAt.toISOString(),
      updatedAt: bookingRequest.updatedAt.toISOString(),
      service: bookingRequest.service
        ? {
            id: bookingRequest.service.id,
            businessId: bookingRequest.service.businessId,
            name: bookingRequest.service.name,
            durationMinutes: bookingRequest.service.durationMinutes,
            description: bookingRequest.service.description,
            active: bookingRequest.service.active,
            paymentRequired: bookingRequest.service.paymentRequired,
            depositAmountCents: bookingRequest.service.depositAmountCents,
            currency: bookingRequest.service.currency,
            createdAt: bookingRequest.service.createdAt.toISOString(),
            updatedAt: bookingRequest.service.updatedAt.toISOString(),
          }
        : null,
    };

    // Sync to CRM (non-blocking)
    try {
      await syncBookingToCrm({
        businessId: settings.businessId,
        request: formatted,
        service: formatted.service,
      });
    } catch (crmError) {
      console.warn("[OBD Scheduler] CRM sync failed (non-blocking):", crmError);
    }

    // Get business name and notification email from settings
    let businessName = "Business";
    let notificationEmail: string | null = null;

    try {
      const bookingSettings = await prisma.bookingSettings.findUnique({
        where: { businessId: settings.businessId },
        select: { notificationEmail: true },
      });

      if (bookingSettings?.notificationEmail) {
        notificationEmail = bookingSettings.notificationEmail;
      }

      const brandProfile = await prisma.brandProfile.findUnique({
        where: { userId: settings.businessId },
        select: { businessName: true },
      });

      if (brandProfile?.businessName) {
        businessName = brandProfile.businessName;
      }
    } catch (error) {
      console.warn("[OBD Scheduler] Failed to fetch settings/brand profile (non-blocking):", error);
    }

    // Collect email warnings (non-blocking)
    const warnings: string[] = [];

    // Send customer confirmation email (non-blocking)
    // Note: For instant bookings, we might want a different email template
    // For now, we'll use the same confirmation email
    try {
      const { sendCustomerRequestConfirmationEmail } = await import(
        "@/lib/apps/obd-scheduler/notifications"
      );
      await sendCustomerRequestConfirmationEmail({
        request: formatted,
        service: formatted.service,
        businessName,
      });
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      console.warn(
        `[OBD Scheduler] Customer confirmation email failed (non-blocking) for bookingId ${formatted.id}:`,
        errorMessage
      );
      warnings.push("Confirmation email could not be sent.");
    }

    // Send business notification email (non-blocking)
    if (notificationEmail) {
      try {
        const { sendBusinessRequestNotificationEmail } = await import(
          "@/lib/apps/obd-scheduler/notifications"
        );
        await sendBusinessRequestNotificationEmail(
          {
            request: formatted,
            service: formatted.service,
            businessName,
          },
          notificationEmail
        );
      } catch (emailError) {
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        console.warn(
          `[OBD Scheduler] Business notification email failed (non-blocking) for bookingId ${formatted.id}, businessId ${settings.businessId}:`,
          errorMessage
        );
        warnings.push("Business notification email could not be sent.");
      }
    }

    // Return response with optional warnings
    const response = apiSuccessResponse(formatted, 201);
    const responseData = await response.json();
    
    // Add warnings if any exist
    if (warnings.length > 0) {
      return NextResponse.json(
        {
          ...responseData,
          warnings,
        },
        { status: 201 }
      );
    }

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}


