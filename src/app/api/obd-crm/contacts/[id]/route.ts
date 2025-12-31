/**
 * OBD CRM Contact Detail API Route (V3)
 * 
 * Handles getting, updating, and deleting a single contact.
 * GET: Get contact by ID
 * PATCH: Update contact
 * DELETE: Delete contact
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
  CrmContact,
  CrmContactStatus,
  UpdateContactRequest,
} from "@/lib/apps/obd-crm/types";

export const runtime = "nodejs";

// Validation schema
const updateContactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200).optional(),
  email: z
    .string()
    .email("Invalid email format")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)), // Convert empty strings to null
  phone: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)), // Convert empty strings to null
  company: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)), // Convert empty strings to null
  address: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)), // Convert empty strings to null
  status: z.enum(["Lead", "Active", "Past", "DoNotContact"]).optional(),
  tagIds: z.array(z.string()).optional(),
  nextFollowUpAt: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === "") return null;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    }),
  nextFollowUpNote: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

// Helper: Format contact from DB (same as in contacts/route.ts)
function formatContact(contact: any): CrmContact {
  return {
    id: contact.id,
    businessId: contact.businessId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
    address: contact.address,
    status: contact.status as CrmContactStatus,
    source: contact.source,
    tags: (contact.tags || []).map((ct: any) => ({
      id: ct.tag.id,
      businessId: ct.tag.businessId,
      name: ct.tag.name,
      color: ct.tag.color,
      createdAt: ct.tag.createdAt.toISOString(),
      updatedAt: ct.tag.updatedAt.toISOString(),
    })),
    nextFollowUpAt: contact.nextFollowUpAt ? contact.nextFollowUpAt.toISOString() : null,
    nextFollowUpNote: contact.nextFollowUpNote || null,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

// Helper: Format activity from DB
function formatActivity(activity: any): any {
  return {
    id: activity.id,
    contactId: activity.contactId,
    businessId: activity.businessId,
    type: activity.type,
    content: activity.content,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

/**
 * GET /api/obd-crm/contacts/[id]
 * Get a single contact by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Dev-only safety check
  if (process.env.NODE_ENV !== "production") {
    if (!prisma?.crmContact) {
      console.error("[OBD CRM] Prisma client or crmContact model missing in contacts/[id] GET route");
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
        tags: {
          include: {
            tag: true,
          },
        },
        activities: {
          where: {
            type: "note",
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!contact) {
      return apiErrorResponse("Contact not found", "UPSTREAM_NOT_FOUND", 404);
    }

    const formattedContact = formatContact(contact);
    const formattedActivities = (contact.activities || []).map(formatActivity);
    
    // Return contact with activities included
    return apiSuccessResponse({
      ...formattedContact,
      activities: formattedActivities,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/obd-crm/contacts/[id]
 * Update a contact
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  // Dev-only safety check
  if (process.env.NODE_ENV !== "production") {
    if (!prisma?.crmContact) {
      console.error("[OBD CRM] Prisma client or crmContact model missing in contacts/[id] PATCH route");
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
    const existingContact = await prisma.crmContact.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existingContact) {
      return apiErrorResponse("Contact not found", "UPSTREAM_NOT_FOUND", 404);
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request
    const validationResult = updateContactSchema.safeParse(json);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Validate tagIds belong to this business if provided
    if (data.tagIds && data.tagIds.length > 0) {
      const tagCount = await prisma.crmTag.count({
        where: {
          id: { in: data.tagIds },
          businessId,
        },
      });
      if (tagCount !== data.tagIds.length) {
        return apiErrorResponse(
          "One or more tags not found or do not belong to your business",
          "VALIDATION_ERROR",
          400
        );
      }
    }

    // Build update data
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.company !== undefined) updateData.company = data.company;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.nextFollowUpAt !== undefined) updateData.nextFollowUpAt = data.nextFollowUpAt;
    if (data.nextFollowUpNote !== undefined) updateData.nextFollowUpNote = data.nextFollowUpNote;

    // Handle tag updates (replace all tags if tagIds provided)
    if (data.tagIds !== undefined) {
      // Delete existing tag relations
      await prisma.crmContactTag.deleteMany({
        where: {
          contactId: id,
        },
      });

      // Create new tag relations if any
      if (data.tagIds.length > 0) {
        await prisma.crmContactTag.createMany({
          data: data.tagIds.map((tagId) => ({
            contactId: id,
            tagId,
          })),
        });
      }
    }

    // Update contact
    const contact = await prisma.crmContact.update({
      where: {
        id,
      },
      data: updateData,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    const formattedContact = formatContact(contact);
    return apiSuccessResponse(formattedContact);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/obd-crm/contacts/[id]
 * Delete a contact
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  // Dev-only safety check
  if (process.env.NODE_ENV !== "production") {
    if (!prisma?.crmContact) {
      console.error("[OBD CRM] Prisma client or crmContact model missing in contacts/[id] DELETE route");
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
    const existingContact = await prisma.crmContact.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existingContact) {
      return apiErrorResponse("Contact not found", "UPSTREAM_NOT_FOUND", 404);
    }

    // Delete contact (cascade will handle related records)
    await prisma.crmContact.delete({
      where: {
        id,
      },
    });

    return apiSuccessResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

