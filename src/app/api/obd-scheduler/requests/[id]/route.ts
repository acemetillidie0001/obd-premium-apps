/**
 * OBD Scheduler & Booking - Individual Request API Route (V3)
 * 
 * GET: Get one booking request
 * PATCH: Update request status (approve/decline/propose-time/mark-complete)
 * DELETE: Delete request (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";
import { z } from "zod";
import { sanitizeText } from "@/lib/utils/sanitizeText";
import type {
  BookingRequest,
  BookingStatus,
  UpdateBookingRequestRequest,
} from "@/lib/apps/obd-scheduler/types";
import {
  sendRequestApprovedEmail,
  sendRequestDeclinedEmail,
  sendProposedTimeEmail,
  sendBookingCompletedEmail,
} from "@/lib/apps/obd-scheduler/notifications";
import { BookingStatus as PrismaBookingStatus } from "@prisma/client";

export const runtime = "nodejs";

// Validation schema
const updateRequestSchema = z.object({
  status: z.enum(["REQUESTED", "APPROVED", "DECLINED", "PROPOSED_TIME", "COMPLETED", "CANCELED"]).optional(),
  proposedStart: z.string().datetime().optional().nullable(),
  proposedEnd: z.string().datetime().optional().nullable(),
  internalNotes: z.string().max(5000).optional().nullable(),
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
      paymentRequired: request.service.paymentRequired,
      depositAmountCents: request.service.depositAmountCents,
      currency: request.service.currency,
      createdAt: request.service.createdAt.toISOString(),
      updatedAt: request.service.updatedAt.toISOString(),
    } : null,
  };
}

/**
 * GET /api/obd-scheduler/requests/[id]
 * Get one booking request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  warnIfBusinessIdParamPresent(request);

  try {
    const prisma = getPrisma();
    const { businessId } = await requireTenant();
    await requirePermission("OBD_SCHEDULER", "VIEW");

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    const { id } = await params;

    const bookingRequest = await prisma.bookingRequest.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
        service: true,
      },
    });

    if (!bookingRequest) {
      return apiErrorResponse("Booking request not found", "NOT_FOUND", 404);
    }

    return apiSuccessResponse(formatRequest(bookingRequest));
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

/**
 * PATCH /api/obd-scheduler/requests/[id]
 * Update booking request status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  warnIfBusinessIdParamPresent(request);

  try {
    const prisma = getPrisma();
    const { businessId } = await requireTenant();
    await requirePermission("OBD_SCHEDULER", "EDIT_DRAFT");

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    const { id } = await params;

    // Get existing request
    const existing = await prisma.bookingRequest.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
        service: true,
      },
    });

    if (!existing) {
      return apiErrorResponse("Booking request not found", "NOT_FOUND", 404);
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request body
    const parsed = updateRequestSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // Validate proposedEnd > proposedStart if both provided
    if (body.proposedStart && body.proposedEnd) {
      const start = new Date(body.proposedStart);
      const end = new Date(body.proposedEnd);
      if (end <= start) {
        return apiErrorResponse(
          "Proposed end time must be after proposed start time",
          "VALIDATION_ERROR",
          400
        );
      }
    }

    // Validate status transitions
    if (body.status) {
      const newStatus = body.status as PrismaBookingStatus;
      const currentStatus = existing.status as PrismaBookingStatus;

      // Valid transitions
      const validTransitions: Record<string, string[]> = {
        REQUESTED: ["APPROVED", "DECLINED", "PROPOSED_TIME", "CANCELED"],
        PROPOSED_TIME: ["APPROVED", "DECLINED", "CANCELED"],
        APPROVED: ["COMPLETED", "CANCELED"],
        DECLINED: [], // Terminal state
        COMPLETED: [], // Terminal state
        CANCELED: [], // Terminal state
      };

      const allowed = validTransitions[currentStatus] || [];
      if (!allowed.includes(newStatus)) {
        return apiErrorResponse(
          `Invalid status transition from ${currentStatus} to ${newStatus}`,
          "VALIDATION_ERROR",
          400
        );
      }

      // Require proposed times for PROPOSED_TIME status
      if (newStatus === PrismaBookingStatus.PROPOSED_TIME) {
        if (!body.proposedStart || !body.proposedEnd) {
          return apiErrorResponse(
            "Proposed start and end times are required for PROPOSED_TIME status",
            "VALIDATION_ERROR",
            400
          );
        }
      }
    }

    // Build update data
    const updateData: any = {};

    if (body.status !== undefined) {
      updateData.status = body.status as PrismaBookingStatus;
    }

    if (body.proposedStart !== undefined) {
      updateData.proposedStart = body.proposedStart ? new Date(body.proposedStart) : null;
    }

    if (body.proposedEnd !== undefined) {
      updateData.proposedEnd = body.proposedEnd ? new Date(body.proposedEnd) : null;
    }

    if (body.internalNotes !== undefined) {
      updateData.internalNotes = body.internalNotes ? sanitizeText(body.internalNotes) : null;
    }

    // Update request
    const updated = await prisma.bookingRequest.update({
      where: { id },
      data: updateData,
      include: {
        service: true,
      },
    });

    // Send appropriate notification email
    const formatted = formatRequest(updated);
    const context = {
      request: formatted,
      service: formatted.service,
    };

    try {
      if (body.status) {
        switch (body.status) {
          case "APPROVED":
            await sendRequestApprovedEmail(context);
            break;
          case "DECLINED":
            await sendRequestDeclinedEmail(context);
            break;
          case "PROPOSED_TIME":
            await sendProposedTimeEmail(context);
            break;
          case "COMPLETED":
            await sendBookingCompletedEmail(context);
            break;
        }
      }
    } catch (emailError) {
      // Log but don't fail the request
      console.error("[OBD Scheduler] Failed to send notification email:", emailError);
    }

    return apiSuccessResponse(formatted);
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

/**
 * DELETE /api/obd-scheduler/requests/[id]
 * Delete booking request (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  warnIfBusinessIdParamPresent(request);

  try {
    const prisma = getPrisma();
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    // Check if user is admin
    if (user.role !== "admin") {
      return apiErrorResponse("Admin access required", "FORBIDDEN", 403);
    }

    const { businessId } = await requireTenant();
    await requirePermission("OBD_SCHEDULER", "DELETE");

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    const { id } = await params;

    // Verify request exists and belongs to business
    const existing = await prisma.bookingRequest.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existing) {
      return apiErrorResponse("Booking request not found", "NOT_FOUND", 404);
    }

    // Delete request
    await prisma.bookingRequest.delete({
      where: { id },
    });

    return apiSuccessResponse({ deleted: true });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

