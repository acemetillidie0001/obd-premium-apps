/**
 * OBD Scheduler & Booking - Requests API Route (V3)
 * 
 * GET: List booking requests (scoped to business)
 * POST: Create booking request (public form or authenticated)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type {
  BookingRequest,
  BookingStatus,
  CreateBookingRequestRequest,
  BookingRequestListQuery,
  BookingRequestListResponse,
} from "@/lib/apps/obd-scheduler/types";
import {
  sendCustomerRequestConfirmationEmail,
  sendBusinessRequestNotificationEmail,
} from "@/lib/apps/obd-scheduler/notifications";
import { syncBookingToCrm } from "@/lib/apps/obd-scheduler/integrations/crm";
import { BookingStatus as PrismaBookingStatus } from "@prisma/client";

export const runtime = "nodejs";

// Validation schemas
const createRequestSchema = z.object({
  serviceId: z.string().optional().nullable(),
  customerName: z.string().min(1, "Customer name is required").max(200),
  customerEmail: z.string().email("Invalid email format"),
  customerPhone: z.string().max(50).optional().nullable(),
  preferredStart: z.string().datetime().optional().nullable(),
  preferredEnd: z.string().datetime().optional().nullable(), // Ignored for backward compatibility
  message: z.string().max(2000).optional().nullable(),
  bookingKey: z.string().optional(), // For public form
});

// Helper: Format request from DB
function formatRequest(request: any): BookingRequest {
  return {
    id: request.id,
    businessId: request.businessId,
    serviceId: request.serviceId,
    customerName: request.customerName,
    customerEmail: request.customerEmail,
    customerPhone: request.customerPhone,
    preferredStart: request.preferredStart?.toISOString() || null,
    preferredEnd: request.preferredEnd?.toISOString() || null,
    message: request.message,
    status: request.status as BookingStatus,
    proposedStart: request.proposedStart?.toISOString() || null,
    proposedEnd: request.proposedEnd?.toISOString() || null,
    internalNotes: request.internalNotes,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    service: request.service ? {
      id: request.service.id,
      businessId: request.service.businessId,
      name: request.service.name,
      durationMinutes: request.service.durationMinutes,
      description: request.service.description,
      active: request.service.active,
      createdAt: request.service.createdAt.toISOString(),
      updatedAt: request.service.updatedAt.toISOString(),
    } : null,
  };
}

/**
 * GET /api/obd-scheduler/requests
 * List booking requests (authenticated, scoped to business)
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as BookingStatus | null;
    const serviceId = searchParams.get("serviceId") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const sort = (searchParams.get("sort") || "createdAt") as "createdAt" | "updatedAt" | "preferredStart";
    const order = (searchParams.get("order") || "desc") as "asc" | "desc";

    // Build where clause
    const where: any = {
      businessId,
    };

    if (status) {
      where.status = status;
    }

    if (serviceId) {
      where.serviceId = serviceId;
    }

    // Search filter (customer name, email)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { customerName: { contains: searchTerm, mode: "insensitive" } },
        { customerEmail: { contains: searchTerm, mode: "insensitive" } },
      ];
    }


    // Get total count
    const total = await prisma.bookingRequest.count({ where });

    // Get requests
    const requests = await prisma.bookingRequest.findMany({
      where,
      include: {
        service: true,
      },
      orderBy: {
        [sort]: order,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const response: BookingRequestListResponse = {
      requests: requests.map(formatRequest),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return apiSuccessResponse(response);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/obd-scheduler/requests
 * Create a new booking request (public form or authenticated)
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
    const parsed = createRequestSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // preferredEnd is ignored for backward compatibility (always set to null for new requests)

    // Determine businessId
    let businessId: string;
    
    if (body.bookingKey) {
      // Public form: look up business by bookingKey
      const settings = await prisma.bookingSettings.findUnique({
        where: { bookingKey: body.bookingKey },
        select: { businessId: true },
      });

      if (!settings) {
        return apiErrorResponse("Invalid booking key", "NOT_FOUND", 404);
      }

      businessId = settings.businessId;
    } else {
      // Authenticated: use current user's businessId
      const guard = await requirePremiumAccess();
      if (guard) return guard;

      const user = await getCurrentUser();
      if (!user) {
        return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
      }

      businessId = user.id; // V3: userId = businessId
    }

    // Verify service exists and belongs to business (if provided)
    if (body.serviceId) {
      const service = await prisma.bookingService.findFirst({
        where: {
          id: body.serviceId,
          businessId,
          active: true,
        },
      });

      if (!service) {
        return apiErrorResponse("Service not found or inactive", "INVALID_SERVICE", 400);
      }
    }

    // Create request
    const bookingRequest = await prisma.bookingRequest.create({
      data: {
        businessId,
        serviceId: body.serviceId || null,
        customerName: body.customerName.trim(),
        customerEmail: body.customerEmail.trim().toLowerCase(),
        customerPhone: body.customerPhone?.trim() || null,
        preferredStart: body.preferredStart ? new Date(body.preferredStart) : null,
        preferredEnd: null, // Always null for new requests (start-only preferred time)
        message: body.message?.trim() || null,
        status: PrismaBookingStatus.REQUESTED,
      },
      include: {
        service: true,
      },
    });

    const formatted = formatRequest(bookingRequest);

    // Sync to CRM (non-blocking, fails gracefully)
    try {
      await syncBookingToCrm({
        businessId,
        request: formatted,
        service: formatted.service,
      });
    } catch (crmError) {
      // Log but don't fail the booking request
      console.warn("[OBD Scheduler] CRM sync failed (non-blocking):", crmError);
    }

    // Get business name and notification email from settings
    let businessName = "Business";
    let notificationEmail: string | null = null;

    try {
      const bookingSettings = await prisma.bookingSettings.findUnique({
        where: { businessId },
        select: { notificationEmail: true },
      });

      if (bookingSettings?.notificationEmail) {
        notificationEmail = bookingSettings.notificationEmail;
      }

      // Try to get business name from BrandProfile
      const brandProfile = await prisma.brandProfile.findUnique({
        where: { userId: businessId },
        select: { businessName: true },
      });

      if (brandProfile?.businessName) {
        businessName = brandProfile.businessName;
      }
    } catch (error) {
      // Log but don't fail the booking request
      console.warn("[OBD Scheduler] Failed to fetch settings/brand profile (non-blocking):", error);
    }

    // Send customer confirmation email (non-blocking)
    try {
      await sendCustomerRequestConfirmationEmail({
        request: formatted,
        service: formatted.service,
        businessName,
      });
    } catch (emailError) {
      // Log but don't fail the booking request
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      console.warn(`[OBD Scheduler] Customer confirmation email failed (non-blocking) for requestId ${formatted.id}:`, errorMessage);
    }

    // Send business notification email (non-blocking, only if notificationEmail is set)
    if (notificationEmail) {
      try {
        await sendBusinessRequestNotificationEmail(
          {
            request: formatted,
            service: formatted.service,
            businessName,
          },
          notificationEmail
        );
      } catch (emailError) {
        // Log but don't fail the booking request
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        console.warn(`[OBD Scheduler] Business notification email failed (non-blocking) for requestId ${formatted.id}, businessId ${businessId}:`, errorMessage);
      }
    } else {
      // Log warning if notification email is not configured
      console.warn(`[OBD Scheduler] Notification email not configured for businessId ${businessId} (requestId: ${formatted.id}). Please set notificationEmail in booking settings.`);
    }

    return apiSuccessResponse(formatted, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

