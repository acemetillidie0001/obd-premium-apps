/**
 * OBD Scheduler → CRM Manual Link (V1, no automation)
 *
 * POST /api/obd-scheduler/requests/[id]/link-crm
 * Body: { crmContactId: string }
 *
 * Persists linkage as a deterministic BookingRequestAuditLog entry.
 * No background jobs, no external calls, tenant-scoped.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";
import { z } from "zod";

export const runtime = "nodejs";

const linkSchema = z.object({
  crmContactId: z.string().min(1, "crmContactId is required"),
});

function readCrmContactIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const v = (metadata as any).crmContactId;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  warnIfBusinessIdParamPresent(request);

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const { businessId } = await requireTenant();
    await requirePermission("OBD_SCHEDULER", "EDIT_DRAFT");

    // Keep existing pilot behavior: requests/features are activation-gated
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse("Scheduler is currently in pilot rollout.", "PILOT_ONLY", 403);
    }

    const { id } = await context.params;

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    const parsed = linkSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const crmContactId = parsed.data.crmContactId.trim();

    const bookingRequest = await prisma.bookingRequest.findFirst({
      where: { id, businessId },
      select: { id: true, businessId: true, status: true },
    });
    if (!bookingRequest) {
      return apiErrorResponse("Booking request not found", "NOT_FOUND", 404);
    }

    const contact = await prisma.crmContact.findFirst({
      where: { id: crmContactId, businessId },
      select: { id: true, name: true },
    });
    if (!contact) {
      return apiErrorResponse("CRM contact not found", "NOT_FOUND", 404);
    }

    const latestLink = await prisma.bookingRequestAuditLog.findFirst({
      where: {
        businessId,
        requestId: id,
        action: "CRM_LINKED",
      },
      orderBy: { createdAt: "desc" },
      select: { metadata: true, createdAt: true },
    });

    const alreadyLinkedTo = latestLink ? readCrmContactIdFromMetadata(latestLink.metadata) : null;
    if (alreadyLinkedTo === crmContactId) {
      return apiSuccessResponse({
        requestId: id,
        crmContactId,
        contact,
        linkedAt: latestLink?.createdAt?.toISOString?.() ?? null,
        alreadyLinked: true,
      });
    }

    const log = await prisma.bookingRequestAuditLog.create({
      data: {
        businessId,
        requestId: id,
        actorUserId: null,
        action: "CRM_LINKED",
        fromStatus: bookingRequest.status,
        toStatus: bookingRequest.status,
        metadata: { crmContactId },
      },
      select: { createdAt: true },
    });

    return apiSuccessResponse({
      requestId: id,
      crmContactId,
      contact,
      linkedAt: log.createdAt.toISOString(),
      alreadyLinked: false,
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

