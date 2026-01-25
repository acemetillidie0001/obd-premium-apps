/**
 * OBD CRM Contact Summary API Route (V3)
 * 
 * Returns a minimal summary of a contact for integration purposes.
 * GET: Get contact summary (name, lastNote, lastActivity)
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant } from "@/lib/auth/tenant";

export const runtime = "nodejs";

/**
 * GET /api/obd-crm/contacts/[id]/summary
 * Get contact summary (minimal data for integrations)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Dev-only safety check
  if (process.env.NODE_ENV !== "production") {
    if (!prisma?.crmContact || !prisma?.crmContactActivity) {
      console.error("[OBD CRM] Prisma client or models missing in contacts/[id]/summary GET route");
      return apiErrorResponse("Database client not initialized", "INTERNAL_ERROR", 500);
    }
  }

  try {
    const { businessId, role, userId } = await requireTenant();
    void role;
    void userId;
    await requirePermission("OBD_CRM", "VIEW");
    const { id } = await params;

    const contact = await prisma.crmContact.findFirst({
      where: {
        id,
        businessId, // Ensure contact belongs to this business
      },
      include: {
        activities: {
          where: {
            type: "note",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // Only get the most recent note
        },
      },
    });

    if (!contact) {
      return apiErrorResponse("Contact not found", "UPSTREAM_NOT_FOUND", 404);
    }

    // Return minimal summary
    return apiSuccessResponse({
      name: contact.name,
      lastNote: contact.activities?.[0]?.content || null,
      lastActivity: contact.activities?.[0]?.content || null, // For now, same as lastNote
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code =
        error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

