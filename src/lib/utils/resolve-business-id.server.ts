/**
 * Server-side Business ID Resolver
 * 
 * This file is server-only and should never be imported by client components.
 * Use resolveBusinessIdServer() for server-side business ID resolution with
 * proper demo mode tenant safety.
 * 
 * CRITICAL TENANT SAFETY: Demo mode must NEVER access real tenants.
 * If the demo cookie is present, this function ALWAYS returns the demo business ID.
 */

import "server-only";

import { hasDemoCookie } from "@/lib/demo/demo-cookie";
import { getDemoBusinessId } from "@/lib/demo/demo-context";
import { BusinessContextError, requireBusinessContext } from "@/lib/auth/requireBusinessContext";
import { cookies } from "next/headers";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Resolves businessId from available sources (SERVER-SIDE VERSION)
 * 
 * CRITICAL TENANT SAFETY: If demo cookie is present, immediately returns demo business ID.
 * Demo mode must never access real tenants - this check happens FIRST, before any other resolution.
 * 
 * DENY-BY-DEFAULT: For real users, businessId is derived from active membership (BusinessUser).
 * `?businessId=` is only accepted if it matches a business the authenticated user belongs to.
 * 
 * @param cookieStore - Next.js cookies instance from `await cookies()`
 * @param searchParams - Optional URL search params object (e.g., from request.nextUrl.searchParams)
 * @returns businessId string or null if not found
 */
export async function resolveBusinessIdServer(
  cookieStore: CookieStore,
  searchParams?: URLSearchParams | null
): Promise<string | null> {
  // PRIORITY 0: Demo mode check (CRITICAL - must happen first for tenant safety)
  // Demo mode must NEVER access real tenants; it always uses the demo businessId
  if (hasDemoCookie(cookieStore)) {
    return getDemoBusinessId();
  }

  // PRIORITY 1: Authenticated membership-derived businessId
  // Optional: allow ?businessId= only if it matches a business the user belongs to.
  const requestedBusinessId = searchParams?.get("businessId")?.trim() || null;

  try {
    const ctx = await requireBusinessContext({ requestedBusinessId });
    return ctx.businessId;
  } catch (err) {
    // Deny-by-default: if we can't safely resolve membership, return null.
    // Callers should treat null as "no tenant context" and refuse the request.
    const message = err instanceof Error ? err.message : String(err);
    const status =
      err instanceof BusinessContextError ? err.status : undefined;

    if (process.env.NODE_ENV !== "production") {
      console.warn("[resolveBusinessIdServer] Unable to resolve business context", {
        status,
        message,
      });
    }

    return null;
  }
}

