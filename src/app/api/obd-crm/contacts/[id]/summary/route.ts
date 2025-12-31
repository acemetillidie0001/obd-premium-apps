/**
 * OBD CRM Contact Summary API Route (V3)
 * 
 * Returns a minimal summary of a contact for integration purposes.
 * GET: Get contact summary (name, lastNote, lastActivity)
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { prisma } from "@/lib/prisma";

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
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId
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
    return handleApiError(error);
  }
}

