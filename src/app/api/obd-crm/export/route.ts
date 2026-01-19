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
  notes: z.enum(["all", "withNotes"]).optional(),
  sort: z.enum(["updatedAt", "createdAt", "name", "lastTouchAt", "nextFollowUpAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  // When followUp filter is used, client can pass a canonical "today" window (in absolute time)
  // so export matches the UI's bucket boundaries regardless of server timezone.
  todayWindow: z
    .object({
      startOfToday: z.string(),
      endOfToday: z.string(),
    })
    .optional(),
});

function toTimeOrNull(v: unknown): number | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function compareForExport(
  a: { id: string; name: string; createdAt: Date; updatedAt: Date; nextFollowUpAt: Date | null; activities?: Array<{ createdAt: Date }> },
  b: { id: string; name: string; createdAt: Date; updatedAt: Date; nextFollowUpAt: Date | null; activities?: Array<{ createdAt: Date }> },
  key: "updatedAt" | "createdAt" | "name" | "lastTouchAt" | "nextFollowUpAt",
  order: "asc" | "desc"
): number {
  const dir = order === "asc" ? 1 : -1;
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

  if (key === "name") {
    const cmp = collator.compare(a.name, b.name);
    if (cmp !== 0) return cmp * dir;
  } else if (key === "createdAt") {
    const at = toTimeOrNull(a.createdAt) ?? 0;
    const bt = toTimeOrNull(b.createdAt) ?? 0;
    if (at !== bt) return (at - bt) * dir;
  } else if (key === "updatedAt") {
    const at = toTimeOrNull(a.updatedAt) ?? 0;
    const bt = toTimeOrNull(b.updatedAt) ?? 0;
    if (at !== bt) return (at - bt) * dir;
  } else if (key === "lastTouchAt") {
    const at = toTimeOrNull(a.activities?.[0]?.createdAt) ?? -Infinity;
    const bt = toTimeOrNull(b.activities?.[0]?.createdAt) ?? -Infinity;
    if (at !== bt) return (at - bt) * dir;
  } else if (key === "nextFollowUpAt") {
    const at = toTimeOrNull(a.nextFollowUpAt) ?? Infinity;
    const bt = toTimeOrNull(b.nextFollowUpAt) ?? Infinity;
    if (at !== bt) return (at - bt) * dir;
  }

  // Tie-breaker: stable by id
  return a.id.localeCompare(b.id);
}

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

    const {
      search,
      status,
      tagId,
      followUp = "all",
      notes = "all",
      sort = "updatedAt",
      order = "desc",
      todayWindow,
    } = validationResult.data;

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

    // Notes filter (align with canonical selector)
    // Selector treats "withNotes" as: has any CRM note (lastTouchAt/lastNote present).
    if (notes === "withNotes") {
      where.activities = {
        some: {
          type: "note",
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
      // Prefer client-provided boundaries (absolute times) to avoid server-timezone drift
      const startOfToday = todayWindow?.startOfToday ? new Date(todayWindow.startOfToday) : null;
      const endOfToday = todayWindow?.endOfToday ? new Date(todayWindow.endOfToday) : null;
      const fallbackNow = new Date();
      const fallbackStartOfToday = new Date(
        fallbackNow.getFullYear(),
        fallbackNow.getMonth(),
        fallbackNow.getDate(),
        0,
        0,
        0,
        0
      );
      const fallbackEndOfToday = new Date(
        fallbackNow.getFullYear(),
        fallbackNow.getMonth(),
        fallbackNow.getDate(),
        23,
        59,
        59,
        999
      );
      const start = startOfToday && Number.isFinite(startOfToday.getTime()) ? startOfToday : fallbackStartOfToday;
      const end = endOfToday && Number.isFinite(endOfToday.getTime()) ? endOfToday : fallbackEndOfToday;

      if (followUp === "none") {
        where.nextFollowUpAt = null;
      } else if (followUp === "overdue") {
        where.nextFollowUpAt = { lt: start };
      } else if (followUp === "today") {
        where.nextFollowUpAt = { gte: start, lte: end };
      } else if (followUp === "upcoming") {
        where.nextFollowUpAt = { gt: end };
      }
    }

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
    });

    // Sort in-process to match UI selector semantics (supports computed sort like lastTouchAt)
    contacts.sort((a, b) =>
      compareForExport(
        {
          id: a.id,
          name: a.name,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          nextFollowUpAt: (a as any).nextFollowUpAt ?? null,
          activities: (a as any).activities ?? [],
        },
        {
          id: b.id,
          name: b.name,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
          nextFollowUpAt: (b as any).nextFollowUpAt ?? null,
          activities: (b as any).activities ?? [],
        },
        sort,
        order
      )
    );

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

