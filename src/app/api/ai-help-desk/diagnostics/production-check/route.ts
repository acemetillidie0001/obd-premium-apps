/**
 * AI Help Desk Production Readiness Check API
 * 
 * Admin-only endpoint to verify production readiness.
 * Checks environment variables and database tables.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser, isAdmin } from "@/lib/premium";
import { checkAiHelpDeskProductionReadiness } from "@/lib/diagnostics/aiHelpDeskProdCheck";

export const runtime = "nodejs";

/**
 * GET /api/ai-help-desk/diagnostics/production-check
 * 
 * Returns production readiness status:
 * - Environment variable checks
 * - Database table checks
 * - Summary with blocking issues and warnings
 * 
 * Admin-only access required.
 */
export async function GET(request: NextRequest) {
  // Require premium access (must be logged in)
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    // Check if user is admin
    const user = await getCurrentUser();
    
    if (!user) {
      return apiErrorResponse(
        "Authentication required",
        "UNAUTHORIZED",
        401
      );
    }

    // Check 1: User role is admin
    const userIsAdmin = await isAdmin();
    
    // Check 2: Email allowlist (fallback/temporary approach)
    let isEmailAdmin = false;
    const adminEmailsEnv = process.env.AI_HELP_DESK_ADMIN_EMAILS;
    if (adminEmailsEnv && user.email) {
      const adminEmails = adminEmailsEnv
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0);
      
      const userEmailLower = user.email.toLowerCase();
      isEmailAdmin = adminEmails.includes(userEmailLower);
    }

    // Require admin access
    if (!userIsAdmin && !isEmailAdmin) {
      return apiErrorResponse(
        "Admin access required",
        "UNAUTHORIZED",
        403
      );
    }

    // Run production readiness check
    const result = await checkAiHelpDeskProductionReadiness();

    return apiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

