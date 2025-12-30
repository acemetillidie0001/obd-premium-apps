import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { handleApiError, apiSuccessResponse } from "@/lib/api/errorHandler";
import { getCurrentUser, isAdmin } from "@/lib/premium";

export const runtime = "nodejs";

/**
 * Check if the current user is an admin for AI Help Desk
 * 
 * Admin status is determined by:
 * 1. User role === "admin" (from session/DB)
 * 2. OR user email matches AI_HELP_DESK_ADMIN_EMAILS allowlist (comma-separated)
 * 
 * Returns { ok: true, data: { isAdmin: boolean } }
 */
export async function GET(request: NextRequest) {
  // Require premium access (must be logged in)
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const user = await getCurrentUser();
    
    if (!user) {
      // Not authenticated (shouldn't reach here due to premium guard, but handle gracefully)
      return apiSuccessResponse({ isAdmin: false });
    }

    // Check 1: User role is admin
    const userIsAdmin = await isAdmin();
    if (userIsAdmin) {
      return apiSuccessResponse({ isAdmin: true });
    }

    // Check 2: Email allowlist (fallback/temporary approach)
    const adminEmailsEnv = process.env.AI_HELP_DESK_ADMIN_EMAILS;
    if (adminEmailsEnv && user.email) {
      const adminEmails = adminEmailsEnv
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0);
      
      const userEmailLower = user.email.toLowerCase();
      if (adminEmails.includes(userEmailLower)) {
        return apiSuccessResponse({ isAdmin: true });
      }
    }

    // Not an admin
    return apiSuccessResponse({ isAdmin: false });
  } catch (error) {
    return handleApiError(error);
  }
}

