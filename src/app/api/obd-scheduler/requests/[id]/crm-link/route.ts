/**
 * OBD Scheduler → CRM Link Status (read-only)
 *
 * GET /api/obd-scheduler/requests/[id]/crm-link
 *
 * Returns the latest manual CRM linkage for a booking request (if any).
 * Deterministic, tenant-scoped, no external calls.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";

export const runtime = "nodejs";

function readCrmContactIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const v = (metadata as any).crmContactId;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  warnIfBusinessIdParamPresent(request);

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const { businessId } = await requireTenant();
    await requirePermission("OBD_SCHEDULER", "VIEW");

    // Keep existing pilot behavior: requests/features are activation-gated
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse("Scheduler is currently in pilot rollout.", "PILOT_ONLY", 403);
    }

    const { id } = await context.params;

    const bookingRequest = await prisma.bookingRequest.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!bookingRequest) {
      return apiErrorResponse("Booking request not found", "NOT_FOUND", 404);
    }

    const latestLink = await prisma.bookingRequestAuditLog.findFirst({
      where: { businessId, requestId: id, action: "CRM_LINKED" },
      orderBy: { createdAt: "desc" },
      select: { metadata: true, createdAt: true },
    });

    const crmContactId = latestLink ? readCrmContactIdFromMetadata(latestLink.metadata) : null;
    if (!crmContactId) {
      return apiSuccessResponse({ linked: false, crmContactId: null, contact: null, linkedAt: null });
    }

    const contact = await prisma.crmContact.findFirst({
      where: { id: crmContactId, businessId },
      select: { id: true, name: true, email: true, phone: true },
    });

    if (!contact) {
      // Link exists but contact is missing; return as unlinked (safe fallback)
      return apiSuccessResponse({ linked: false, crmContactId: null, contact: null, linkedAt: null });
    }

    return apiSuccessResponse({
      linked: true,
      crmContactId: contact.id,
      contact,
      linkedAt: latestLink?.createdAt?.toISOString?.() ?? null,
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

