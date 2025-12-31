/**
 * OBD CRM Contacts API Route (V3)
 * 
 * Handles listing and creating contacts.
 * GET: List contacts with search, filters, and pagination
 * POST: Create a new contact
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { verifyCrmDatabaseSetup, selfTestErrorResponse } from "@/lib/apps/obd-crm/devSelfTest";
import { handleCrmDatabaseError } from "@/lib/apps/obd-crm/dbErrorHandler";
import { z } from "zod";
import type {
  CrmContact,
  CrmContactStatus,
  CreateContactRequest,
  ContactListQuery,
  ContactListResponse,
} from "@/lib/apps/obd-crm/types";

export const runtime = "nodejs";

// Validation schemas
const createContactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
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
  source: z.enum(["manual", "scheduler", "reviews", "helpdesk", "import"]).optional(),
  tagIds: z.array(z.string()).optional(),
});

// Helper: Format contact from DB
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
    lastNote: undefined, // Will be set by caller if needed
    nextFollowUpAt: contact.nextFollowUpAt ? contact.nextFollowUpAt.toISOString() : null,
    nextFollowUpNote: contact.nextFollowUpNote || null,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

/**
 * GET /api/obd-crm/contacts
 * List contacts with optional search, filters, and pagination
 */
export async function GET(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Dev-only self-test: Verify database connectivity and required tables
  const selfTest = await verifyCrmDatabaseSetup();
  if (!selfTest.ok) {
    return selfTestErrorResponse(selfTest);
  }

  // Legacy dev-only safety check (kept for additional validation)
  if (process.env.NODE_ENV !== "production") {
    if (!prisma) {
      console.error("[OBD CRM] Prisma client missing in contacts route");
      return apiErrorResponse("Database client not initialized", "INTERNAL_ERROR", 500);
    }
    if (!prisma.crmContact) {
      console.error("[OBD CRM] prisma.crmContact is undefined - Prisma client may not be generated correctly");
      return apiErrorResponse("Database models not available", "INTERNAL_ERROR", 500);
    }
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId (one user = one business)

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") as CrmContactStatus | null;
    const tagId = searchParams.get("tagId") || undefined;
    const sort = searchParams.get("sort") || "updatedAt";
    const order = searchParams.get("order") || "desc";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    // Build where clause
    const where: any = {
      businessId,
    };

    // Search filter (name, email, phone)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { phone: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Tag filter
    if (tagId) {
      where.tags = {
        some: {
          tagId,
        },
      };
    }

    // Build orderBy
    const orderBy: any = {};
    orderBy[sort] = order;

    // Get total count
    const total = await prisma.crmContact.count({ where });

    // Get contacts
    const contacts = await prisma.crmContact.findMany({
      where,
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
          take: 1,
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    const formattedContacts = contacts.map((contact) => {
      const formatted = formatContact(contact);
      // Add lastNote preview and lastTouchAt timestamp (truncate to 100 chars for list view)
      const lastActivity = contact.activities?.[0];
      if (lastActivity?.content) {
        const preview = lastActivity.content.length > 100
          ? lastActivity.content.substring(0, 100) + "..."
          : lastActivity.content;
        return { 
          ...formatted, 
          lastNote: preview,
          lastTouchAt: lastActivity.createdAt.toISOString(),
        };
      }
      return { 
        ...formatted, 
        lastNote: null,
        lastTouchAt: null,
      };
    });

    const response: ContactListResponse = {
      contacts: formattedContacts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return apiSuccessResponse(response);
  } catch (error) {
    // Check for database-specific errors first
    const dbError = handleCrmDatabaseError(error);
    if (dbError) {
      return dbError;
    }
    return handleApiError(error);
  }
}

/**
 * POST /api/obd-crm/contacts
 * Create a new contact
 */
export async function POST(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  // Dev-only self-test: Verify database connectivity and required tables
  const selfTest = await verifyCrmDatabaseSetup();
  if (!selfTest.ok) {
    return selfTestErrorResponse(selfTest);
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request
    const validationResult = createContactSchema.safeParse(json);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Validate tagIds belong to this business
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

    // Create contact
    const contact = await prisma.crmContact.create({
      data: {
        businessId,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        address: data.address || null,
        status: data.status || "Lead",
        source: data.source || "manual",
        tags: data.tagIds
          ? {
              create: data.tagIds.map((tagId) => ({
                tagId,
              })),
            }
          : undefined,
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    const formattedContact = formatContact(contact);

    return apiSuccessResponse(formattedContact, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

