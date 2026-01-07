/**
 * OBD CRM Contact Import API Route (V3)
 * 
 * Handles bulk import of contacts from CSV.
 * POST: Import contacts from provided rows
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

// Validation schema for import row
const importRowSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email format").optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  status: z.enum(["Lead", "Active", "Past", "DoNotContact"]).optional(),
  tags: z.array(z.string()).optional(),
});

const importRequestSchema = z.object({
  rows: z.array(importRowSchema).min(1, "At least one row is required").max(1000, "Maximum 1000 rows per import"),
});

/**
 * POST /api/obd-crm/contacts/import
 * Import contacts from CSV data
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

  // Dev-only safety check
  if (process.env.NODE_ENV !== "production") {
    if (!prisma?.crmContact) {
      console.error("[OBD CRM] Prisma client or crmContact model missing in contacts/import POST route");
      return apiErrorResponse("Database client not initialized", "INTERNAL_ERROR", 500);
    }
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

    // Validate request structure
    const validationResult = importRequestSchema.safeParse(json);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { rows } = validationResult.data;

    // Validate and process each row
    const validRows: Array<{
      name: string;
      email: string | null;
      phone: string | null;
      status: "Lead" | "Active" | "Past" | "DoNotContact";
      tagIds: string[];
    }> = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      // Validate row
      const rowValidation = importRowSchema.safeParse(row);
      if (!rowValidation.success) {
        errors.push({
          row: rowNumber,
          error: rowValidation.error.issues.map((e) => e.message).join(", "),
        });
        continue;
      }

      const validRow = rowValidation.data;

      // Normalize email/phone (empty strings to null)
      const email = validRow.email && validRow.email.trim() ? validRow.email.trim() : null;
      const phone = validRow.phone && validRow.phone.trim() ? validRow.phone.trim() : null;

      // Validate that at least email or phone is provided for deduplication
      // (Actually, we'll allow contacts with just name, but they won't be deduplicated)
      
      // Validate tag names and convert to IDs if provided
      let tagIds: string[] = [];
      if (validRow.tags && validRow.tags.length > 0) {
        // Try to find tags by name (case-insensitive)
        const tags = await prisma.crmTag.findMany({
          where: {
            businessId,
            name: { in: validRow.tags.map((n) => n.trim()) },
          },
        });
        
        // Check if all tag names were found
        const foundTagNames = new Set(tags.map((t) => t.name.toLowerCase()));
        const missingTags = validRow.tags.filter(
          (name) => !foundTagNames.has(name.trim().toLowerCase())
        );
        
        if (missingTags.length > 0) {
          errors.push({
            row: rowNumber,
            error: `Tags not found: ${missingTags.join(", ")}`,
          });
          continue;
        }
        
        tagIds = tags.map((t) => t.id);
      }

      validRows.push({
        name: validRow.name.trim(),
        email,
        phone,
        status: validRow.status || "Lead",
        tagIds,
      });
    }

    if (validRows.length === 0) {
      return apiErrorResponse("No valid rows to import", "VALIDATION_ERROR", 400);
    }

    // Check for duplicates (by email or phone) and existing contacts
    const existingContacts = await prisma.crmContact.findMany({
      where: {
        businessId,
        OR: [
          { email: { in: validRows.filter((r) => r.email).map((r) => r.email!) } },
          { phone: { in: validRows.filter((r) => r.phone).map((r) => r.phone!) } },
        ],
      },
      select: {
        email: true,
        phone: true,
      },
    });

    const existingEmails = new Set(existingContacts.filter((c) => c.email).map((c) => c.email!));
    const existingPhones = new Set(existingContacts.filter((c) => c.phone).map((c) => c.phone!));

    // Filter out duplicates
    const rowsToImport: typeof validRows = [];
    let skippedCount = 0;

    for (const row of validRows) {
      const isDuplicate =
        (row.email && existingEmails.has(row.email)) ||
        (row.phone && existingPhones.has(row.phone));

      if (isDuplicate) {
        skippedCount++;
      } else {
        rowsToImport.push(row);
        // Track new emails/phones to avoid duplicates within the same import batch
        if (row.email) existingEmails.add(row.email);
        if (row.phone) existingPhones.add(row.phone);
      }
    }

    if (rowsToImport.length === 0) {
      return apiSuccessResponse({
        createdCount: 0,
        skippedCount: skippedCount + validRows.length - rowsToImport.length,
        errors: errors.length > 0 ? errors : undefined,
        message: "All rows were skipped (duplicates or invalid)",
      });
    }

    // Create contacts in a transaction
    const createdContacts = await prisma.$transaction(
      rowsToImport.map((row) =>
        prisma.crmContact.create({
          data: {
            businessId,
            name: row.name,
            email: row.email,
            phone: row.phone,
            status: row.status,
            source: "import",
            tags: row.tagIds.length > 0
              ? {
                  create: row.tagIds.map((tagId) => ({
                    tagId,
                  })),
                }
              : undefined,
          },
        })
      )
    );

    return apiSuccessResponse({
      createdCount: createdContacts.length,
      skippedCount: skippedCount + (validRows.length - rowsToImport.length),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

