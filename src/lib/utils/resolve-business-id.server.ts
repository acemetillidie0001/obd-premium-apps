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

import { hasDemoCookie } from "@/lib/demo/demo-cookie";
import { getDemoBusinessId } from "@/lib/demo/demo-context";
import { cookies } from "next/headers";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Resolves businessId from available sources (SERVER-SIDE VERSION)
 * 
 * CRITICAL TENANT SAFETY: If demo cookie is present, immediately returns demo business ID.
 * Demo mode must never access real tenants - this check happens FIRST, before any other resolution.
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

  // Priority 1: URL search params (if provided)
  if (searchParams) {
    const businessIdFromUrl = searchParams.get("businessId");
    if (businessIdFromUrl && businessIdFromUrl.trim().length > 0) {
      return businessIdFromUrl.trim();
    }
  }

  // Priority 2: Future - Session/user object
  // TODO: When session access is available server-side, check session.user.id

  // Priority 3: Future - Business context provider
  // TODO: When a global business context is implemented, check it here

  return null;
}

