import "server-only";

import { auth } from "@/lib/auth";
import { LAST_ACTIVE_TOUCH_WINDOW_MS, touchLastActive } from "@/lib/auth/touch-last-active.server";
import { isDemoFromCookies } from "@/lib/demo/demo-context";
import { badRequest, forbidden, unauthorized } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import type { TeamRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export type BusinessContext = {
  userId: string;
  businessId: string;
  role: TeamRole;
};

export class BusinessContextError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "BusinessContextError";
    this.status = status;
    this.code = code;
  }

  /**
   * Standard HTTP JSON response for authz-related failures.
   * Ensures 401/403 share a uniform payload shape across routes.
   */
  toHttpResponse(): NextResponse {
    if (this.status === 401) return unauthorized(this.message);
    if (this.status === 403) return forbidden(this.message);
    if (this.status === 400) return badRequest(this.message);

    // Fallback for non-authz errors (e.g., 503 membership lookup failures).
    return NextResponse.json(
      {
        error: this.code || "ERROR",
        message: this.message,
      },
      { status: this.status }
    );
  }
}

type RequireBusinessContextOptions = {
  /**
   * Optional businessId selector for multi-business future.
   * If provided, it is ONLY accepted if the user has an ACTIVE membership in that business.
   */
  requestedBusinessId?: string | null;
};

/**
 * Requires an authenticated, membership-derived business context.
 *
 * v1 assumption:
 * - 1 business per user today (backfilled as OWNER membership).
 * - If multiple ACTIVE memberships exist, pick the oldest OWNER membership, otherwise the first by createdAt (deterministic).
 *
 * Throws BusinessContextError:
 * - 401 if unauthenticated
 * - 403 if no ACTIVE membership (or requested business not allowed)
 * - 503 if membership lookup fails (e.g., DB unavailable)
 */
export async function requireBusinessContext(
  options: RequireBusinessContextOptions = {}
): Promise<BusinessContext> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new BusinessContextError("Authentication required", 401, "UNAUTHORIZED");
  }

  let memberships: Array<{
    businessId: string;
    role: TeamRole;
    createdAt: Date;
    lastActiveAt: Date | null;
  }> = [];

  try {
    memberships = await prisma.businessUser.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      select: {
        businessId: true,
        role: true,
        createdAt: true,
        lastActiveAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new BusinessContextError(
      `Unable to resolve business membership: ${msg}`,
      503,
      "BUSINESS_CONTEXT_UNAVAILABLE"
    );
  }

  if (!memberships.length) {
    throw new BusinessContextError(
      "No active business membership found for this account.",
      403,
      "BUSINESS_MEMBERSHIP_REQUIRED"
    );
  }

  const requestedBusinessId = options.requestedBusinessId?.trim() || null;
  const selectedMembership = requestedBusinessId
    ? memberships.find((m) => m.businessId === requestedBusinessId) ?? null
    : (() => {
        // Oldest OWNER membership (deterministic because memberships are createdAt asc)
        const owner = memberships.find((m) => m.role === "OWNER");
        return owner ?? memberships[0];
      })();

  if (!selectedMembership) {
    throw new BusinessContextError(
      "Business access denied.",
      403,
      "BUSINESS_ACCESS_DENIED"
    );
  }

  // Best-effort touch (never blocks authz). Skip in demo mode.
  try {
    const cookieStore = await cookies();
    const isDemo = isDemoFromCookies(cookieStore);

    if (!isDemo) {
      const now = Date.now();
      const lastActiveMs = selectedMembership.lastActiveAt?.getTime() ?? null;
      const shouldTouch = lastActiveMs === null || now - lastActiveMs > LAST_ACTIVE_TOUCH_WINDOW_MS;

      if (shouldTouch) {
        await touchLastActive(selectedMembership.businessId, userId);
      }
    }
  } catch {
    // Intentionally swallow: lastActive tracking must never fail access control.
  }

  return { userId, businessId: selectedMembership.businessId, role: selectedMembership.role };
}

