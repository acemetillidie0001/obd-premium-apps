/**
 * Suite Onboarding Dismiss API (explicit action)
 *
 * POST /api/onboarding/dismiss
 * Body: { dismissed: true }
 *
 * - Business-scoped (membership-derived tenant context)
 * - Explicit mutation only (no automation)
 * - Stable response shape (no nested "data" wrapper)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, handleApiError } from "@/lib/api/errorHandler";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

const BodySchema = z.object({
  dismissed: z.boolean(),
});

type DismissResponse = {
  ok: true;
  dismissed: boolean;
  dismissedAt: string | null;
};

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  warnIfBusinessIdParamPresent(request);

  try {
    const { businessId } = await requirePermission("TEAMS_USERS", "VIEW");

    let prisma;
    try {
      prisma = getPrisma();
    } catch {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const json = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return apiErrorResponse("Invalid request body", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const dismissed = parsed.data.dismissed === true;
    const dismissedAtNext = dismissed ? new Date() : null;

    const row = await prisma.onboardingState.upsert({
      where: { businessId },
      create: { businessId, onboardingDismissedAt: dismissedAtNext },
      update: { onboardingDismissedAt: dismissedAtNext },
      select: { onboardingDismissedAt: true },
    });

    const dismissedAtISO = toIsoOrNull(row.onboardingDismissedAt);

    const response: DismissResponse = {
      ok: true,
      dismissed: dismissedAtISO !== null,
      dismissedAt: dismissedAtISO,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

