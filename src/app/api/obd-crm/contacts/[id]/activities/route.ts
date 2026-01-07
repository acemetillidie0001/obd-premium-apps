/**
 * OBD CRM Contact Activities API Route (V3)
 * 
 * Handles getting and creating activities for a contact.
 * GET: List activities for a contact (newest first)
 * POST: Add a new activity to a contact
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

// Activity types
const ActivityType = z.enum(["CALL", "EMAIL", "TEXT", "MEETING", "TASK", "OTHER"]);

// Validation schema
const addActivitySchema = z.object({
  type: ActivityType,
  summary: z.string().min(1, "Activity summary is required").max(1000),
  occurredAt: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date;
  }),
});

// Helper: Format activity from DB
function formatActivity(activity: any) {
  return {
    id: activity.id,
    contactId: activity.contactId,
    businessId: activity.businessId,
    type: activity.type,
    summary: activity.summary,
    content: activity.content, // For notes
    occurredAt: activity.occurredAt ? activity.occurredAt.toISOString() : null,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

/**
 * GET /api/obd-crm/contacts/[id]/activities
 * List activities for a contact (newest first, excluding notes)
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
      console.error("[OBD CRM] Prisma client or models missing in contacts/[id]/activities GET route");
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

    // Get activities (excluding notes) for this contact, ordered by occurredAt (or createdAt if occurredAt is null)
    const activities = await prisma.crmContactActivity.findMany({
      where: {
        contactId: id,
        businessId,
        type: { not: "note" }, // Exclude notes
      },
      orderBy: {
        createdAt: "desc", // Sort by createdAt (newest first) - occurredAt can be null
      },
    });
    
    // Sort by occurredAt if available, otherwise use createdAt
    activities.sort((a, b) => {
      const dateA = (a as any).occurredAt || a.createdAt;
      const dateB = (b as any).occurredAt || b.createdAt;
      return dateB.getTime() - dateA.getTime();
    });

    const formattedActivities = activities.map(formatActivity);

    return apiSuccessResponse({
      activities: formattedActivities,
      count: formattedActivities.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/obd-crm/contacts/[id]/activities
 * Add an activity to a contact
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

  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  // Dev-only safety check
  if (process.env.NODE_ENV !== "production") {
    if (!prisma?.crmContact || !prisma?.crmContactActivity) {
      console.error("[OBD CRM] Prisma client or models missing in contacts/[id]/activities POST route");
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
    const validationResult = addActivitySchema.safeParse(json);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { type, summary, occurredAt } = validationResult.data;

    // Create activity
    const activity = await prisma.crmContactActivity.create({
      data: {
        contactId: id,
        businessId,
        type,
        summary: summary.trim(),
        occurredAt: occurredAt || new Date(), // Default to now if not provided
      } as any,
    });

    const formattedActivity = formatActivity(activity);

    return apiSuccessResponse(formattedActivity, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

