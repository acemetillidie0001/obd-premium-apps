/**
 * OBD Scheduler → AI Help Desk (apply-only)
 *
 * POST /api/obd-scheduler/help-desk/apply-booking-instructions
 *
 * Creates/updates exactly one tenant-scoped AI Help Desk knowledge entry:
 * - title: "Booking Instructions"
 * - tags includes: "Scheduler"
 *
 * Deterministic + idempotent (no duplicates): apply twice updates the same entry.
 * No external calls, no background jobs, no schema changes.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { apiErrorResponse, handleApiError } from "@/lib/api/errorHandler";
import { validationErrorResponse } from "@/lib/api/validationError";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Text is required")
    .max(2000, "Text must be 2000 characters or less"),
});

const TITLE = "Booking Instructions";
const TAG = "Scheduler";

function uniqStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v || "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

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
    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const { businessId, role, userId } = await requireTenant();
    void role;
    void userId;

    // Require both: scheduler manage settings (source) + help desk draft edit (target)
    await requirePermission("OBD_SCHEDULER", "MANAGE_SETTINGS");
    await requirePermission("AI_HELP_DESK", "EDIT_DRAFT");

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const text = parsed.data.text.trim();

    // Find existing entry for this business (idempotent)
    const existing = await prisma.aiHelpDeskEntry.findFirst({
      where: {
        businessId,
        title: TITLE,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      const tags = uniqStrings([...(existing.tags || []), TAG]);
      const updated = await prisma.aiHelpDeskEntry.update({
        where: { id: existing.id },
        data: {
          type: "POLICY",
          content: text,
          tags,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json(
        { ok: true, mode: "updated", entryId: updated.id },
        { status: 200 }
      );
    }

    const created = await prisma.aiHelpDeskEntry.create({
      data: {
        businessId,
        type: "POLICY",
        title: TITLE,
        content: text,
        tags: [TAG],
        isActive: true,
      },
    });

    return NextResponse.json(
      { ok: true, mode: "created", entryId: created.id },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

