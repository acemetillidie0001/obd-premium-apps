/**
 * OBD CRM Export API Route (V3)
 * 
 * Handles CSV export of contacts with optional filters.
 * POST: Export contacts as CSV
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type {
  CrmContactStatus,
  ExportContactsRequest,
} from "@/lib/apps/obd-crm/types";

export const runtime = "nodejs";

// Validation schema
const exportRequestSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["Lead", "Active", "Past", "DoNotContact"]).optional(),
  tagId: z.string().optional(),
  followUp: z.enum(["all", "overdue", "today", "upcoming", "none"]).optional(),
  sort: z.enum(["updatedAt", "createdAt", "name", "lastTouchAt", "nextFollowUpAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

/**
 * Escape CSV field value.
 * - null/undefined -> ""
 * - If contains comma, quote, \n or \r -> wrap in double quotes
 * - Escape quotes by doubling them
 */
function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  
  const stringValue = String(value);
  
  // If contains comma, quote, newline, or carriage return, wrap in quotes
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n") || stringValue.includes("\r")) {
    // Escape quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Format tags for CSV (join with " | " separator)
 */
function formatTagsForCsv(tags: Array<{ name: string }>): string {
  return tags.map((t) => t.name).join(" | ");
}

/**
 * POST /api/obd-crm/export
 * Export contacts as CSV
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
      console.error("[OBD CRM] Prisma client or crmContact model missing in export route");
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

    // Validate request
    const validationResult = exportRequestSchema.safeParse(json);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { search, status, tagId, followUp = "all", sort = "updatedAt", order = "desc" } = validationResult.data;

    // Build where clause (same logic as GET /contacts)
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

    // Follow-up bucket filter (align with canonical selector)
    // Bucket rules:
    // - overdue: nextFollowUpAt < startOfToday
    // - today: startOfToday <= nextFollowUpAt <= endOfToday
    // - upcoming: nextFollowUpAt > endOfToday
    // - none: nextFollowUpAt is null
    if (followUp && followUp !== "all") {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      if (followUp === "none") {
        where.nextFollowUpAt = null;
      } else if (followUp === "overdue") {
        where.nextFollowUpAt = { lt: startOfToday };
      } else if (followUp === "today") {
        where.nextFollowUpAt = { gte: startOfToday, lte: endOfToday };
      } else if (followUp === "upcoming") {
        where.nextFollowUpAt = { gt: endOfToday };
      }
    }

    // Build orderBy (align with canonical selector)
    const orderBy: any = {};
    // For fields that can be null, Prisma sorts nulls first in asc; this matches the UI's deterministic ordering closely enough
    orderBy[sort] = order;

    // Get all contacts matching filters (no pagination - export all matches)
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
          take: 1, // Get most recent note for lastNote column
        },
      },
      orderBy,
    });

    // Build CSV headers (in specified order)
    const headers = [
      "name",
      "email",
      "phone",
      "status",
      "tags",
      "source",
      "createdAt",
      "updatedAt",
      "lastNote",
    ];

    // Build CSV rows
    const rows = contacts.map((contact) => {
      // Get lastNote (truncate to 200 chars if present)
      let lastNote: string | null = null;
      const lastActivity = contact.activities?.[0];
      if (lastActivity?.content) {
        lastNote = lastActivity.content.length > 200
          ? lastActivity.content.substring(0, 200)
          : lastActivity.content;
      }

      return [
        csvEscape(contact.name),
        csvEscape(contact.email),
        csvEscape(contact.phone),
        csvEscape(contact.status),
        csvEscape(formatTagsForCsv(contact.tags.map((ct) => ({ name: ct.tag.name })))),
        csvEscape(contact.source),
        csvEscape(contact.createdAt.toISOString()),
        csvEscape(contact.updatedAt.toISOString()),
        csvEscape(lastNote),
      ];
    });

    const csvLines = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ];

    const csvContent = csvLines.join("\n");

    // Generate filename with date (YYYY-MM-DD format)
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `obd-crm-contacts-${dateStr}.csv`;

    // Return raw CSV body with proper headers
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

