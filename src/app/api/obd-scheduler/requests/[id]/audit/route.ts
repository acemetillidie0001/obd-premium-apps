/**
 * OBD Scheduler & Booking - Request Audit Log API Route
 * 
 * GET: Fetch audit log entries for a booking request
 * Authenticated, scoped to businessId
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant } from "@/lib/auth/tenant";

export const runtime = "nodejs";

/**
 * GET /api/obd-scheduler/requests/[id]/audit
 * Fetch audit log entries for a booking request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request, "obd-scheduler:audit");
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const prisma = getPrisma();
    const { businessId, role, userId } = await requireTenant();
    void role;
    void userId;
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

    // Verify request exists and belongs to business
    const bookingRequest = await prisma.bookingRequest.findFirst({
      where: {
        id,
        businessId,
      },
      select: {
        id: true,
      },
    });

    if (!bookingRequest) {
      return apiErrorResponse("Booking request not found", "NOT_FOUND", 404);
    }

    // Fetch audit log entries (most recent first)
    const auditLogs = await prisma.bookingRequestAuditLog.findMany({
      where: {
        requestId: id,
        businessId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        action: true,
        fromStatus: true,
        toStatus: true,
        actorUserId: true,
        createdAt: true,
        metadata: true,
      },
    });

    // Format response
    const formatted = auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      actorUserId: log.actorUserId,
      createdAt: log.createdAt.toISOString(),
      metadata: log.metadata,
    }));

    return apiSuccessResponse(formatted);
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code =
        error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

