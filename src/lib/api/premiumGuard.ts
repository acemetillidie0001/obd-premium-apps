import { NextResponse } from "next/server";
import { hasPremiumAccessSafe } from "@/lib/premium";

/**
 * Premium Guard Utility
 * 
 * Enforces authentication and premium access for premium AI routes.
 * Returns a consistent error response format when access is denied.
 * 
 * Usage:
 * ```typescript
 * export async function POST(req: Request) {
 *   const guard = await requirePremiumAccess();
 *   if (guard) return guard; // Early return if access denied
 *   
 *   // User is authenticated and has premium access
 *   // Continue with route logic...
 * }
 * ```
 */

/**
 * Require premium access for an API route.
 * 
 * Returns:
 * - null if user is authenticated and has premium access (continue processing)
 * - NextResponse with error if access is denied (return this from route handler)
 * 
 * Status codes:
 * - 401: User is not authenticated (code: "UNAUTHORIZED")
 * - 403: User is authenticated but does not have premium access (code: "PREMIUM_REQUIRED")
 */
export async function requirePremiumAccess(): Promise<NextResponse | null> {
  const premiumCheck = await hasPremiumAccessSafe();

  // Not authenticated or auth check failed
  if (!premiumCheck.ok) {
    if (premiumCheck.error === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          ok: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }
    // UNAVAILABLE case - treat as unauthorized (DB unavailable)
    return NextResponse.json(
      {
        ok: false,
        error: premiumCheck.message || "Authentication service unavailable",
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  // Authenticated but not premium
  if (!premiumCheck.isPremium) {
    return NextResponse.json(
      {
        ok: false,
        error: "Premium access required",
        code: "PREMIUM_REQUIRED",
      },
      { status: 403 }
    );
  }

  // User has premium access - return null to continue processing
  return null;
}

