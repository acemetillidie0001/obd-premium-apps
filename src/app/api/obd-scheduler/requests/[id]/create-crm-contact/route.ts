/**
 * OBD Scheduler → CRM Manual Contact Creation (V1, no automation)
 *
 * POST /api/obd-scheduler/requests/[id]/create-crm-contact
 * Body: { name?: string, email?: string, phone?: string }
 *
 * Creates a CRM contact (tenant-scoped) and links it to the booking request
 * via a deterministic BookingRequestAuditLog entry.
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

const createSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200).optional(),
  email: z
    .string()
    .email("Invalid email format")
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v ?? null)),
  phone: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v ?? null)),
});

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
    // Creating CRM contacts should respect CRM permissions too
    await requirePermission("OBD_CRM", "EDIT_DRAFT");

    // Keep existing pilot behavior: requests/features are activation-gated
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse("Scheduler is currently in pilot rollout.", "PILOT_ONLY", 403);
    }

    const { id } = await context.params;

    const bookingRequest = await prisma.bookingRequest.findFirst({
      where: { id, businessId },
      select: {
        id: true,
        businessId: true,
        status: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
      },
    });
    if (!bookingRequest) {
      return apiErrorResponse("Booking request not found", "NOT_FOUND", 404);
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const name = (parsed.data.name ?? bookingRequest.customerName ?? "").trim();
    if (name.length < 2) {
      return apiErrorResponse("Name must be at least 2 characters", "VALIDATION_ERROR", 400);
    }

    const email = (parsed.data.email ?? bookingRequest.customerEmail ?? null)?.trim() || null;
    const phone = (parsed.data.phone ?? bookingRequest.customerPhone ?? null)?.trim() || null;

    const contact = await prisma.crmContact.create({
      data: {
        businessId,
        name,
        email,
        phone,
        source: "scheduler",
      },
      select: { id: true, name: true, email: true, phone: true },
    });

    const log = await prisma.bookingRequestAuditLog.create({
      data: {
        businessId,
        requestId: id,
        actorUserId: null,
        action: "CRM_LINKED",
        fromStatus: bookingRequest.status,
        toStatus: bookingRequest.status,
        metadata: { crmContactId: contact.id },
      },
      select: { createdAt: true },
    });

    return apiSuccessResponse({
      requestId: id,
      crmContactId: contact.id,
      contact,
      linkedAt: log.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

