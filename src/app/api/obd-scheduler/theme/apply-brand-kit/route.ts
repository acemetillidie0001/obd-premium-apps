/**
 * OBD Scheduler - Apply Brand Kit (Apply-only)
 *
 * POST /api/obd-scheduler/theme/apply-brand-kit
 *
 * - Deterministic, explicit apply (does nothing unless called)
 * - Tenant-safe (membership-derived businessId)
 * - No schema changes, no external calls
 * - Writes to existing bookingTheme persistence only
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { apiErrorResponse, handleApiError } from "@/lib/api/errorHandler";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { getPrisma } from "@/lib/prisma";
import { extractBrandKitActiveSnapshot } from "@/lib/brand/brandKitSnapshot";

export const runtime = "nodejs";

function formatTheme(theme: any) {
  return {
    id: theme.id,
    businessId: theme.businessId,
    logoUrl: theme.logoUrl,
    primaryColor: theme.primaryColor,
    accentColor: theme.accentColor,
    headlineText: theme.headlineText,
    introText: theme.introText,
    createdAt: theme.createdAt.toISOString(),
    updatedAt: theme.updatedAt.toISOString(),
  };
}

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
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
    await requirePermission("OBD_SCHEDULER", "MANAGE_SETTINGS");

    // Read active stored brand kit/profile for this user (tenant-safe via membership-derived context above)
    const profile = await prisma.brandProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return apiErrorResponse(
        "No Brand Kit saved yet. Create one in Brand Kit Builder, then apply it here.",
        "NOT_FOUND",
        404
      );
    }

    const snapshot = extractBrandKitActiveSnapshot(profile);

    const applied: Record<string, string> = {};
    const updateData: Record<string, unknown> = {};

    if (snapshot.businessName) {
      updateData.headlineText = snapshot.businessName;
      applied.headlineText = snapshot.businessName;
    }

    if (snapshot.logoUrl) {
      updateData.logoUrl = snapshot.logoUrl;
      applied.logoUrl = snapshot.logoUrl;
    }

    if (snapshot.primaryColor) {
      updateData.primaryColor = snapshot.primaryColor;
      applied.primaryColor = snapshot.primaryColor;
    }

    if (snapshot.accentColor) {
      updateData.accentColor = snapshot.accentColor;
      applied.accentColor = snapshot.accentColor;
    }

    // Nothing to apply: return ok with empty applied (explicit, deterministic no-op)
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          ok: true,
          applied: {},
          theme: null,
          note: "No Brand Kit fields were available to apply.",
        },
        { status: 200 }
      );
    }

    const existing = await prisma.bookingTheme.findUnique({
      where: { businessId },
    });

    let theme: any;
    if (existing) {
      theme = await prisma.bookingTheme.update({
        where: { businessId },
        data: updateData,
      });
    } else {
      theme = await prisma.bookingTheme.create({
        data: {
          businessId,
          primaryColor: (updateData.primaryColor as string | undefined) || "#29c4a9",
          ...updateData,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        applied,
        theme: formatTheme(theme),
      },
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

