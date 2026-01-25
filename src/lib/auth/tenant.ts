import "server-only";

import { requireBusinessContext, type BusinessContext } from "@/lib/auth/requireBusinessContext";

export type TenantContext = Pick<BusinessContext, "businessId" | "role" | "userId">;

/**
 * Canonical tenant resolver for server routes.
 *
 * Hard rule (migration): updated routes MUST use this as the only source of tenant context.
 */
export async function requireTenant(): Promise<TenantContext> {
  const ctx = await requireBusinessContext();
  return { businessId: ctx.businessId, role: ctx.role, userId: ctx.userId };
}

/**
 * Transitional helper ONLY: reads `?businessId=` from request URL.
 * Do not use as source of truth for tenant scoping.
 */
export function getBusinessIdFromRequestUnsafe(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("businessId");
    const trimmed = raw?.trim() || null;
    return trimmed || null;
  } catch {
    return null;
  }
}

/**
 * Transitional helper: warns in dev if a `?businessId=` param is present.
 * Does not throw.
 */
export function warnIfBusinessIdParamPresent(req: Request): void {
  if (process.env.NODE_ENV === "production") return;

  const businessId = getBusinessIdFromRequestUnsafe(req);
  if (!businessId) return;

  try {
    const url = new URL(req.url);
    // Prefer pathname only to avoid leaking query values in logs.
    console.warn("[tenant] Ignoring businessId param; using membership-derived tenant.", {
      path: url.pathname,
    });
  } catch {
    console.warn("[tenant] Ignoring businessId param; using membership-derived tenant.", {
      path: "(unknown)",
    });
  }
}

