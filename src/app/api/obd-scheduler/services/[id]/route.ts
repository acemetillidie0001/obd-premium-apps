/**
 * OBD Scheduler & Booking - Individual Service API Route (V3)
 * 
 * PATCH: Update service
 * DELETE: Delete service
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { z } from "zod";
import { sanitizeSingleLine, sanitizeText } from "@/lib/utils/sanitizeText";
import type {
  BookingService,
  UpdateServiceRequest,
} from "@/lib/apps/obd-scheduler/types";

export const runtime = "nodejs";

// Validation schema
const updateServiceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  description: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional(),
});

// Helper: Format service from DB
function formatService(service: any): BookingService {
  return {
    id: service.id,
    businessId: service.businessId,
    name: service.name,
    durationMinutes: service.durationMinutes,
    description: service.description,
    active: service.active,
    paymentRequired: service.paymentRequired,
    depositAmountCents: service.depositAmountCents,
    currency: service.currency,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

/**
 * PATCH /api/obd-scheduler/services/[id]
 * Update service
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

  try {
    const prisma = getPrisma();
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    const { id } = await params;

    // Verify service exists and belongs to business
    const existing = await prisma.bookingService.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existing) {
      return apiErrorResponse("Service not found", "NOT_FOUND", 404);
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request body
    const parsed = updateServiceSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // Build update data
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = sanitizeSingleLine(body.name);
    }

    if (body.durationMinutes !== undefined) {
      updateData.durationMinutes = body.durationMinutes;
    }

    if (body.description !== undefined) {
      updateData.description = body.description ? sanitizeText(body.description) : null;
    }

    if (body.active !== undefined) {
      updateData.active = body.active;
    }

    // Update service
    const updated = await prisma.bookingService.update({
      where: { id },
      data: updateData,
    });

    return apiSuccessResponse(formatService(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/obd-scheduler/services/[id]
 * Delete service
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

  try {
    const prisma = getPrisma();
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    const { id } = await params;

    // Verify service exists and belongs to business
    const existing = await prisma.bookingService.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existing) {
      return apiErrorResponse("Service not found", "NOT_FOUND", 404);
    }

    // Check if service has any active requests
    const requestCount = await prisma.bookingRequest.count({
      where: {
        serviceId: id,
        status: {
          in: ["REQUESTED", "APPROVED", "PROPOSED_TIME"],
        },
      },
    });

    if (requestCount > 0) {
      return apiErrorResponse(
        `Cannot delete service with ${requestCount} active booking request(s). Please handle or cancel those requests first.`,
        "VALIDATION_ERROR",
        400
      );
    }

    // Delete service
    await prisma.bookingService.delete({
      where: { id },
    });

    return apiSuccessResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

