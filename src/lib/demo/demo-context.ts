/**
 * Demo Mode Context Helpers
 * 
 * Utilities for determining demo mode state and accessing demo configuration.
 * These functions provide a safe way to check if demo mode is active and
 * retrieve the demo business ID.
 */

import { cookies } from "next/headers";
import { hasDemoCookie } from "./demo-cookie";

type CookieStore = Awaited<ReturnType<typeof cookies>>;
import { requireDemoBusinessId } from "./demo-constants";

/**
 * Checks if demo mode is active based on the presence of the demo cookie.
 * 
 * This is the primary way to determine if a user is in demo mode.
 * The cookie is set when entering demo mode and expires after DEMO_TTL_MINUTES.
 * 
 * @param cookies - Next.js cookies instance from `await cookies()`
 * @returns true if demo mode is active (cookie exists), false otherwise
 * 
 * @example
 * ```typescript
 * import { cookies } from "next/headers";
 * import { isDemoFromCookies } from "@/lib/demo/demo-context";
 * 
 * const cookieStore = await cookies();
 * if (isDemoFromCookies(cookieStore)) {
 *   // User is in demo mode - use demo business ID
 *   const demoBusinessId = getDemoBusinessId();
 * }
 * ```
 */
export function isDemoFromCookies(
  cookieStore: CookieStore
): boolean {
  return hasDemoCookie(cookieStore);
}

/**
 * Gets the demo business ID from environment variables.
 * 
 * Throws a helpful error if DEMO_BUSINESS_ID is not configured.
 * This should only be called when demo mode is active (after checking isDemoFromCookies).
 * 
 * @returns The demo business ID string
 * @throws Error if DEMO_BUSINESS_ID is not set or empty
 * 
 * @example
 * ```typescript
 * import { cookies } from "next/headers";
 * import { isDemoFromCookies, getDemoBusinessId } from "@/lib/demo/demo-context";
 * 
 * const cookieStore = await cookies();
 * if (isDemoFromCookies(cookieStore)) {
 *   const businessId = getDemoBusinessId();
 *   // Use businessId for demo mode operations
 * }
 * ```
 */
export function getDemoBusinessId(): string {
  return requireDemoBusinessId();
}

