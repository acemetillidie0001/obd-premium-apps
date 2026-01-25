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
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
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
import { BookingStatus as PrismaBookingStatus, Prisma } from "@prisma/client";

export const runtime = "nodejs";

// Validation schema
const actionRequestSchema = z.object({
  action: z.enum(["approve", "propose", "decline", "complete", "reactivate"]),
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
 * Helper: Log status change to audit trail (non-blocking)
 * P2-7 / P2-16: Status Change Audit Trail
 */
async function logStatusChange(
  businessId: string,
  requestId: string,
  actorUserId: string | null,
  action: string,
  fromStatus: PrismaBookingStatus,
  toStatus: PrismaBookingStatus,
  metadata?: Record<string, any>
): Promise<string | null> {
  try {
    const prisma = getPrisma();
    await prisma.bookingRequestAuditLog.create({
      data: {
        businessId,
        requestId,
        actorUserId,
        action,
        fromStatus,
        toStatus,
        metadata: metadata ? metadata : Prisma.JsonNull,
      },
    });
    return null; // Success, no warning
  } catch (error) {
    // Log error but don't throw - audit logging must never block main action
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[OBD Scheduler] Failed to log audit trail for request ${requestId}, action ${action}:`,
      errorMessage
    );
    return `Audit logging failed: ${errorMessage}`;
  }
}

/**
 * POST /api/obd-scheduler/requests/[id]/action
 * Perform approve/propose/decline action on booking request
 */
export async function POST(
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
  const rateLimitCheck = await checkRateLimit(request, "obd-scheduler:action");
  if (rateLimitCheck) return rateLimitCheck;

  warnIfBusinessIdParamPresent(request);

  try {
    const prisma = getPrisma();
    const { businessId, role, userId } = await requireTenant();
    void role;
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
    
    // Reactivate action can only be performed on DECLINED requests
    if (body.action === "reactivate") {
      if (currentStatus !== PrismaBookingStatus.DECLINED) {
        return apiErrorResponse(
          `Cannot reactivate request with status ${currentStatus}. Only DECLINED requests can be reactivated.`,
          "VALIDATION_ERROR",
          400
        );
      }
    } else if (body.action === "complete") {
      // Complete action can only be performed on APPROVED requests
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
        // P2-9: User-friendly error message
        return apiErrorResponse(
          "Cannot approve booking without a preferred or proposed start time.",
          "VALIDATION_ERROR",
          400
        );
      }
    } else if (body.action === "propose") {
      // Propose requires both proposedStart and proposedEnd
      if (!body.proposedStart || !body.proposedEnd) {
        // P2-9: User-friendly error message
        return apiErrorResponse(
          "Both start time and end time are required when proposing a new time.",
          "VALIDATION_ERROR",
          400
        );
      }

      // Validate proposedEnd > proposedStart
      const start = new Date(body.proposedStart);
      const end = new Date(body.proposedEnd);
      if (end <= start) {
        // P2-9: User-friendly error message
        return apiErrorResponse(
          "End time must be after start time.",
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

    // P2-6: Service validation on update - re-fetch service to ensure it's still active
    if (existing.serviceId) {
      const currentService = await prisma.bookingService.findFirst({
        where: {
          id: existing.serviceId,
          businessId,
          active: true,
        },
      });

      if (!currentService) {
        // Service was deleted or deactivated after request creation
        console.warn(`[OBD Scheduler] Request ${existing.id} references inactive/missing service ${existing.serviceId}`);
        return apiErrorResponse(
          "The service for this booking request is no longer available. Please contact support.",
          "INVALID_SERVICE",
          400
        );
      }
    }

    // Set status based on action
    let newStatus: PrismaBookingStatus;
    if (body.action === "approve") {
      newStatus = PrismaBookingStatus.APPROVED;
      updateData.status = newStatus;
      // For approve: use proposedStart if provided, otherwise use preferredStart
      if (body.proposedStart) {
        updateData.proposedStart = new Date(body.proposedStart);
        // Calculate proposedEnd if not provided (use service duration or default 30 min)
        if (!body.proposedEnd) {
          // P2-6: Use re-fetched service if available, otherwise fallback
          const currentService = existing.serviceId
            ? await prisma.bookingService.findFirst({
                where: { id: existing.serviceId, businessId, active: true },
              })
            : null;
          const durationMinutes = currentService?.durationMinutes || existing.service?.durationMinutes || 30;
          updateData.proposedEnd = new Date(
            new Date(body.proposedStart).getTime() + durationMinutes * 60 * 1000
          );
        } else {
          updateData.proposedEnd = new Date(body.proposedEnd);
        }
      } else if (existing.preferredStart) {
        // P1-10: Validate preferredStart is in the future when approving without proposedStart
        const now = new Date();
        if (existing.preferredStart < now) {
          // Allow past dates for historical bookings but warn (non-blocking)
          console.warn(`[OBD Scheduler] Approving request ${existing.id} with preferredStart in the past: ${existing.preferredStart.toISOString()}`);
        }
        
        // Use preferredStart and calculate end
        updateData.proposedStart = existing.preferredStart;
        const durationMinutes = existing.service?.durationMinutes || 30;
        if (!existing.service || !existing.service.durationMinutes) {
          // P1-10: Warn if using default 30-minute duration when service is missing
          console.warn(`[OBD Scheduler] Approving request ${existing.id} without service duration, using default 30 minutes`);
        }
        updateData.proposedEnd = new Date(
          existing.preferredStart.getTime() + durationMinutes * 60 * 1000
        );
      }
    } else if (body.action === "propose") {
      newStatus = PrismaBookingStatus.PROPOSED_TIME;
      updateData.status = newStatus;
      updateData.proposedStart = new Date(body.proposedStart!);
      updateData.proposedEnd = new Date(body.proposedEnd!);
    } else if (body.action === "decline") {
      newStatus = PrismaBookingStatus.DECLINED;
      updateData.status = newStatus;
    } else if (body.action === "complete") {
      newStatus = PrismaBookingStatus.COMPLETED;
      updateData.status = newStatus;
    } else if (body.action === "reactivate") {
      // P1-11: Reactivate sets status to REQUESTED and clears proposed times
      newStatus = PrismaBookingStatus.REQUESTED;
      updateData.status = newStatus;
      updateData.proposedStart = null;
      updateData.proposedEnd = null;
    } else {
      // TypeScript exhaustiveness check
      const _exhaustive: never = body.action;
      throw new Error(`Unknown action: ${_exhaustive}`);
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

    // P2-7 / P2-16: Log status change to audit trail (non-blocking)
    const warnings: string[] = [];
    if (currentStatus !== newStatus) {
      const auditWarning = await logStatusChange(
        businessId,
        id,
        userId,
        body.action,
        currentStatus,
        newStatus,
        body.internalNotes ? { hasInternalNotes: true } : undefined
      );
      if (auditWarning) {
        warnings.push(auditWarning);
      }
    }

    // Format response
    const formatted = formatRequest(updated);

    // Get business name for email context
    let businessName = "Business";
    try {
      const brandProfile = await prisma.brandProfile.findUnique({
        where: { userId },
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

    // Send appropriate notification email (non-blocking, skip for complete and reactivate actions)
    if (body.action !== "complete" && body.action !== "reactivate") {
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

    // Send SMS notification (non-blocking, behind feature flag, skip for complete and reactivate actions)
    if (body.action !== "complete" && body.action !== "reactivate" && formatted.customerPhone) {
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

    // Return response with warnings if any (non-blocking, included in response)
    return apiSuccessResponse({
      ...formatted,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

