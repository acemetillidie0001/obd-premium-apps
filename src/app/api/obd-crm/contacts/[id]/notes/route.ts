/**
 * OBD CRM Contact Notes API Route (V3)
 * 
 * Handles getting and creating notes for a contact.
 * GET: List notes for a contact
 * POST: Add a new note to a contact
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type {
  CrmContactActivity,
  AddNoteRequest,
} from "@/lib/apps/obd-crm/types";

export const runtime = "nodejs";

// Validation schema
const addNoteSchema = z.object({
  body: z.string().min(1, "Note body is required").max(5000),
});

// Helper: Format activity from DB
function formatActivity(activity: any): CrmContactActivity {
  return {
    id: activity.id,
    contactId: activity.contactId,
    businessId: activity.businessId,
    type: activity.type as "note",
    content: activity.content,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

/**
 * GET /api/obd-crm/contacts/[id]/notes
 * List notes for a contact
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
      console.error("[OBD CRM] Prisma client or models missing in contacts/[id]/notes GET route");
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

    // Verify contact exists and belongs to this business
    const contact = await prisma.crmContact.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!contact) {
      return apiErrorResponse("Contact not found", "UPSTREAM_NOT_FOUND", 404);
    }

    // Get activities (notes) for this contact
    const activities = await prisma.crmContactActivity.findMany({
      where: {
        contactId: id,
        businessId,
        type: "note", // V3 supports notes only
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedActivities = activities.map(formatActivity);

    return apiSuccessResponse({
      notes: formattedActivities,
      count: formattedActivities.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/obd-crm/contacts/[id]/notes
 * Add a note to a contact
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  // Dev-only safety check
  if (process.env.NODE_ENV !== "production") {
    if (!prisma?.crmContact || !prisma?.crmContactActivity) {
      console.error("[OBD CRM] Prisma client or models missing in contacts/[id]/notes POST route");
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

    // Verify contact exists and belongs to this business
    const contact = await prisma.crmContact.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!contact) {
      return apiErrorResponse("Contact not found", "UPSTREAM_NOT_FOUND", 404);
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request
    const validationResult = addNoteSchema.safeParse(json);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { body } = validationResult.data;

    // Create activity (note)
    const activity = await prisma.crmContactActivity.create({
      data: {
        contactId: id,
        businessId,
        type: "note",
        content: body.trim(),
      },
    });

    const formattedActivity = formatActivity(activity);

    return apiSuccessResponse(formattedActivity, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

