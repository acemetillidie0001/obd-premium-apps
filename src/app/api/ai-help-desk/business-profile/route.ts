import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { apiSuccessResponse, handleApiError, apiErrorResponse } from "@/lib/api/errorHandler";
import { apiLogger } from "@/lib/api/logger";
import { BusinessContextError, requireBusinessContext } from "@/lib/auth/requireBusinessContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai-help-desk/business-profile
 * 
 * Returns business profile data (currently just website URL) for a given businessId.
 * Tenant-safe: only returns data for the authenticated user's business.
 * 
 * Query params:
 * - businessId: string (required)
 * 
 * Response:
 * {
 *   ok: true,
 *   data: {
 *     websiteUrl: string | null
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    // TENANT SAFETY: Derive businessId from authenticated membership (deny-by-default)
    let businessId: string;
    try {
      const ctx = await requireBusinessContext();
      businessId = ctx.businessId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (err instanceof BusinessContextError) {
        const code = err.status === 401 ? "UNAUTHORIZED" : err.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
        return apiErrorResponse(msg, code, err.status);
      }
      return apiErrorResponse(msg, "UNAUTHORIZED", 401);
    }

    // TODO: If business website URL is stored in a database table in the future,
    // fetch it here using the businessId. For now, return null.
    // Example future implementation:
    // const business = await prisma.business.findUnique({
    //   where: { id: businessId },
    //   select: { websiteUrl: true }
    // });
    // const websiteUrl = business?.websiteUrl || null;

    const websiteUrl: string | null = null;

    apiLogger.info("ai-help-desk.business-profile.get", {
      businessId,
      hasWebsiteUrl: !!websiteUrl,
    });

    return apiSuccessResponse({
      websiteUrl,
    });
  } catch (error) {
    apiLogger.error("ai-help-desk.business-profile.get", {
      error: error instanceof Error ? error.message : String(error),
    });
    return handleApiError(error);
  }
}

