/**
 * OBD Scheduler & Booking - Request Action API Route (Tier 5.3A)
 * 
 * POST: Perform approve/propose/decline actions on booking requests
 * Authenticated, scoped to businessId
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sanitizeText } from "@/lib/utils/sanitizeText";
import type {
  BookingRequest,
  BookingStatus,
} from "@/lib/apps/obd-scheduler/types";
import {
  sendRequestApprovedEmail,
  sendRequestDeclinedEmail,
  sendProposedTimeEmail,
} from "@/lib/apps/obd-scheduler/notifications";
import { BookingStatus as PrismaBookingStatus } from "@prisma/client";

export const runtime = "nodejs";

// Validation schema
const actionRequestSchema = z.object({
  action: z.enum(["approve", "propose", "decline", "complete"]),
  proposedStart: z.string().datetime().optional(),
  proposedEnd: z.string().datetime().optional(),
  internalNotes: z.string().max(5000).optional().nullable(),
});

// Helper: Format request from DB (reused from requests route)
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
 * POST /api/obd-scheduler/requests/[id]/action
 * Perform approve/propose/decline action on booking request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId
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

    // Parse and validate request body first to get action
    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    const parsed = actionRequestSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // Validate that request is in a state that can be acted on
    const currentStatus = existing.status as PrismaBookingStatus;
    
    // Complete action can only be performed on APPROVED requests
    if (body.action === "complete") {
      if (currentStatus !== PrismaBookingStatus.APPROVED) {
        return apiErrorResponse(
          `Cannot complete request with status ${currentStatus}. Only APPROVED requests can be marked as complete.`,
          "VALIDATION_ERROR",
          400
        );
      }
    } else {
      // Other actions require REQUESTED or PROPOSED_TIME status
      if (currentStatus !== PrismaBookingStatus.REQUESTED && 
          currentStatus !== PrismaBookingStatus.PROPOSED_TIME) {
        return apiErrorResponse(
          `Cannot perform action on request with status ${currentStatus}. Only REQUESTED or PROPOSED_TIME requests can be acted on.`,
          "VALIDATION_ERROR",
          400
        );
      }
    }

    // Validate action-specific requirements
    if (body.action === "approve") {
      // Approve requires either preferredStart OR proposedStart
      if (!existing.preferredStart && !body.proposedStart) {
        return apiErrorResponse(
          "Approve action requires either preferredStart (from request) or proposedStart (in body)",
          "VALIDATION_ERROR",
          400
        );
      }
    } else if (body.action === "propose") {
      // Propose requires both proposedStart and proposedEnd
      if (!body.proposedStart || !body.proposedEnd) {
        return apiErrorResponse(
          "Propose action requires both proposedStart and proposedEnd",
          "VALIDATION_ERROR",
          400
        );
      }

      // Validate proposedEnd > proposedStart
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
    // decline action has no additional requirements

    // Build update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Set status based on action
    if (body.action === "approve") {
      updateData.status = PrismaBookingStatus.APPROVED;
      // For approve: use proposedStart if provided, otherwise use preferredStart
      if (body.proposedStart) {
        updateData.proposedStart = new Date(body.proposedStart);
        // Calculate proposedEnd if not provided (use service duration or default 30 min)
        if (!body.proposedEnd) {
          const durationMinutes = existing.service?.durationMinutes || 30;
          updateData.proposedEnd = new Date(
            new Date(body.proposedStart).getTime() + durationMinutes * 60 * 1000
          );
        } else {
          updateData.proposedEnd = new Date(body.proposedEnd);
        }
      } else if (existing.preferredStart) {
        // Use preferredStart and calculate end
        updateData.proposedStart = existing.preferredStart;
        const durationMinutes = existing.service?.durationMinutes || 30;
        updateData.proposedEnd = new Date(
          existing.preferredStart.getTime() + durationMinutes * 60 * 1000
        );
      }
    } else if (body.action === "propose") {
      updateData.status = PrismaBookingStatus.PROPOSED_TIME;
      updateData.proposedStart = new Date(body.proposedStart!);
      updateData.proposedEnd = new Date(body.proposedEnd!);
    } else if (body.action === "decline") {
      updateData.status = PrismaBookingStatus.DECLINED;
    } else if (body.action === "complete") {
      updateData.status = PrismaBookingStatus.COMPLETED;
    }

    // Update internalNotes if provided
    if (body.internalNotes !== undefined) {
      updateData.internalNotes = body.internalNotes ? sanitizeText(body.internalNotes) : null;
    }

    // Preserve original preferredStart (never update it)
    // preferredStart is already in existing, so we don't need to set it

    // Update request
    const updated = await prisma.bookingRequest.update({
      where: { id },
      data: updateData,
      include: {
        service: true,
      },
    });

    // Format response
    const formatted = formatRequest(updated);

    // Get business name for email context
    let businessName = "Business";
    try {
      const brandProfile = await prisma.brandProfile.findUnique({
        where: { userId: businessId },
        select: { businessName: true },
      });
      if (brandProfile?.businessName) {
        businessName = brandProfile.businessName;
      }
    } catch (error) {
      // Log but don't fail
      console.warn("[OBD Scheduler] Failed to fetch business name (non-blocking):", error);
    }

    // Send appropriate notification email (non-blocking)
    const emailContext = {
      request: formatted,
      service: formatted.service,
      businessName,
    };

    // Send appropriate notification email (non-blocking, skip for complete action)
    if (body.action !== "complete") {
      try {
        if (body.action === "approve") {
          await sendRequestApprovedEmail(emailContext);
        } else if (body.action === "propose") {
          await sendProposedTimeEmail(emailContext);
        } else if (body.action === "decline") {
          await sendRequestDeclinedEmail(emailContext);
        }
      } catch (emailError) {
        // Log but don't fail the request
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        console.warn(
          `[OBD Scheduler] Failed to send ${body.action} notification email (non-blocking) for requestId ${id}:`,
          errorMessage
        );
      }
    }

    // Send SMS notification (non-blocking, behind feature flag, skip for complete action)
    if (body.action !== "complete" && formatted.customerPhone) {
      try {
        // Dynamic import to avoid loading Twilio if SMS is disabled
        const { sendTransactionalSms } = await import("@/lib/sms/sendSms");
        const { shouldSendSmsNow } = await import("@/lib/sms/quietHours");
        const { allowSmsSend } = await import("@/lib/sms/smsRateLimit");
        const { isSmsEnabled } = await import("@/lib/sms/twilioClient");

        if (isSmsEnabled()) {
          const quietCheck = shouldSendSmsNow();
          const rateLimitKey = `${businessId}:${formatted.customerPhone}`;
          
          if (quietCheck.ok && allowSmsSend(rateLimitKey)) {
            // Determine SMS template based on action
            let templateKey: "CONFIRMED" | "PROPOSED" | "DECLINED";
            if (body.action === "approve") {
              templateKey = "CONFIRMED";
            } else if (body.action === "propose") {
              templateKey = "PROPOSED";
            } else {
              templateKey = "DECLINED";
            }

            await sendTransactionalSms(
              formatted.customerPhone,
              templateKey,
              { businessName }
            );
          }
        }
      } catch (smsError) {
        // Log but don't fail the request
        const errorMessage = smsError instanceof Error ? smsError.message : String(smsError);
        console.warn(`[OBD Scheduler] SMS failed (non-blocking) for requestId ${id}:`, errorMessage);
      }
    }

    return apiSuccessResponse(formatted);
  } catch (error) {
    return handleApiError(error);
  }
}

