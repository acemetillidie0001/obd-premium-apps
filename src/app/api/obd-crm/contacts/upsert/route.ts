/**
 * OBD CRM Contacts Upsert API Route (V3)
 * 
 * Optional API endpoint for upserting contacts from external sources.
 * POST: Find existing contact by email/phone or create a new one
 * 
 * This endpoint is intended for integration with other OBD apps (Scheduler, Help Desk, Review Automation).
 * For standard CRM operations, use POST /api/obd-crm/contacts instead.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { z } from "zod";
import { upsertContactFromExternalSource } from "@/lib/apps/obd-crm/crmService";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";

export const runtime = "nodejs";

// Validation schema
const upsertContactSchema = z.object({
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
  source: z.enum(["manual", "scheduler", "reviews", "helpdesk", "import"]),
  tagNames: z.array(z.string()).optional(),
  company: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  address: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

/**
 * POST /api/obd-crm/contacts/upsert
 * Upsert a contact (find by email/phone or create new)
 */
export async function POST(request: NextRequest) {
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
    const { businessId } = await requireTenant();
    await requirePermission("OBD_CRM", "EDIT_DRAFT");

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request
    const validationResult = upsertContactSchema.safeParse(json);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Validate that at least email or phone is provided
    if (!data.email && !data.phone) {
      return apiErrorResponse(
        "At least one of email or phone must be provided for upsert",
        "VALIDATION_ERROR",
        400
      );
    }

    // Upsert contact using service
    const contact = await upsertContactFromExternalSource({
      businessId,
      source: data.source,
      name: data.name,
      email: data.email,
      phone: data.phone,
      tagNames: data.tagNames,
      company: data.company,
      address: data.address,
    });

    return apiSuccessResponse(contact, 200);
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

