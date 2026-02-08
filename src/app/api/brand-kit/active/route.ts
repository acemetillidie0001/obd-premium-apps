/**
 * Brand Kit (Active Snapshot) API
 *
 * GET /api/brand-kit/active
 *
 * - Read-only, tenant-safe (membership-derived business context)
 * - Returns a minimal subset of already-stored Brand Kit/Profile fields
 * - No generation, no external calls
 */

import { NextRequest } from "next/server";
import { apiErrorResponse, apiSuccessResponse, handleApiError } from "@/lib/api/errorHandler";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { getPrisma } from "@/lib/prisma";
import { extractBrandKitActiveSnapshot } from "@/lib/brand/brandKitSnapshot";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  warnIfBusinessIdParamPresent(request);

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const { businessId, role, userId } = await requireTenant();
    void businessId;
    void role;

    // Allow any member to view the active brand kit snapshot.
    await requirePermission("BRAND_PROFILE", "VIEW");

    const profile = await prisma.brandProfile.findUnique({
      where: { userId },
    });

    const snapshot = extractBrandKitActiveSnapshot(profile);

    const missing: string[] = [];
    if (!snapshot.businessName) missing.push("businessName");
    if (!snapshot.primaryColor) missing.push("primaryColor");
    // Logo is optional; don't treat as missing required.

    return apiSuccessResponse({
      snapshot,
      missing,
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

