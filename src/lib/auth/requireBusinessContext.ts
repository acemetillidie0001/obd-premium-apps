import "server-only";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TeamRole } from "@prisma/client";

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

  let memberships: Array<{ businessId: string; role: TeamRole; createdAt: Date }> = [];

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
  if (requestedBusinessId) {
    const match = memberships.find((m) => m.businessId === requestedBusinessId);
    if (!match) {
      throw new BusinessContextError(
        "Business access denied.",
        403,
        "BUSINESS_ACCESS_DENIED"
      );
    }

    return { userId, businessId: match.businessId, role: match.role };
  }

  // Oldest OWNER membership (deterministic because memberships are createdAt asc)
  const owner = memberships.find((m) => m.role === "OWNER");
  const picked = owner ?? memberships[0];

  return { userId, businessId: picked.businessId, role: picked.role };
}

