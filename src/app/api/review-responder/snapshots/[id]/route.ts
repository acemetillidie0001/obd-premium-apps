/**
 * AI Review Responder - Response History (Tier 6-1)
 *
 * GET snapshot detail (tenant-scoped, read-only).
 * No restore/apply actions are exposed.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";

export const runtime = "nodejs";

function isDbUnavailableError(dbError: unknown): boolean {
  const errorCode = (dbError as any)?.code;
  const errorMessage = dbError instanceof Error ? dbError.message.toLowerCase() : String(dbError).toLowerCase();

  const isMissingTableError =
    errorCode === "P2021" ||
    errorCode === "P2022" ||
    errorMessage.includes("does not exist") ||
    (errorMessage.includes("relation") && errorMessage.includes("does not exist")) ||
    errorMessage.includes("no such table") ||
    (errorMessage.includes("table") && errorMessage.includes("does not exist"));

  const isConnectionError =
    dbError instanceof Error &&
    (dbError.message.includes("connect") ||
      dbError.message.includes("timeout") ||
      dbError.message.includes("ECONNREFUSED") ||
      errorCode === "P1001");

  return isMissingTableError || isConnectionError;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    warnIfBusinessIdParamPresent(request);
    const { businessId: tenantBusinessId } = await requireTenant();
    await requirePermission("REVIEW_RESPONDER", "VIEW");

    const { id } = await ctx.params;
    const trimmedId = (id || "").trim();
    if (!trimmedId) {
      return apiErrorResponse("Snapshot ID is required", "VALIDATION_ERROR", 400);
    }

    let snapshot;
    try {
      snapshot = await prisma.reviewResponseSnapshot.findUnique({
        where: { id: trimmedId },
        select: {
          id: true,
          businessId: true,
          createdAt: true,
          inputSummary: true,
          responses: true,
        },
      });
    } catch (dbError) {
      console.error("[Review Responder Snapshot Detail] Database error:", dbError);
      if (isDbUnavailableError(dbError)) {
        return apiErrorResponse("Database unavailable.", "DB_UNAVAILABLE", 503);
      }
      throw dbError;
    }

    if (!snapshot) {
      return apiErrorResponse("Snapshot not found", "NOT_FOUND", 404);
    }

    if (snapshot.businessId !== tenantBusinessId) {
      return apiErrorResponse("Snapshot does not belong to this business", "TENANT_SAFETY_BLOCKED", 403);
    }

    return apiSuccessResponse({
      id: snapshot.id,
      createdAt: snapshot.createdAt.toISOString(),
      inputSummary: snapshot.inputSummary,
      responses: snapshot.responses,
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

