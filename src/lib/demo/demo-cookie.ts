/**
 * Demo Mode Cookie Helpers
 * 
 * Utilities for managing the demo mode cookie.
 * The cookie tracks whether a user is in demo mode and expires after DEMO_TTL_MINUTES.
 * 
 * Cookie name: "obd_demo"
 * Cookie value: "1" (when active)
 * 
 * Security:
 * - httpOnly: true (not accessible via JavaScript)
 * - secure: true in production (HTTPS only)
 * - sameSite: "lax" (CSRF protection)
 * - path: "/" (available site-wide)
 */

import { cookies } from "next/headers";
import { DEMO_TTL_MINUTES } from "./demo-constants";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Cookie name used for demo mode.
 */
export const DEMO_COOKIE = "obd_demo";

/**
 * Sets the demo mode cookie.
 * 
 * Cookie configuration:
 * - httpOnly: true (prevents XSS attacks)
 * - secure: true in production (HTTPS only), false in development
 * - sameSite: "lax" (CSRF protection while allowing top-level navigation)
 * - path: "/" (available on all routes)
 * - maxAge: DEMO_TTL_MINUTES converted to seconds
 * 
 * @param cookies - Next.js cookies instance from `await cookies()`
 * 
 * @example
 * ```typescript
 * import { cookies } from "next/headers";
 * import { setDemoCookie } from "@/lib/demo/demo-cookie";
 * 
 * const cookieStore = await cookies();
 * setDemoCookie(cookieStore);
 * ```
 */
export function setDemoCookie(
  cookieStore: CookieStore | { set: (name: string, value: string, options?: any) => void }
): void {
  // Convert minutes to seconds for maxAge
  const maxAgeSeconds = DEMO_TTL_MINUTES * 60;
  
  // Determine if we're in production
  const isProduction = process.env.NODE_ENV === "production";
  
  // Set cookie with appropriate security settings
  cookieStore.set(DEMO_COOKIE, "1", {
    httpOnly: true, // Prevent JavaScript access (XSS protection)
    secure: isProduction, // HTTPS only in production
    sameSite: "lax", // CSRF protection while allowing top-level navigation
    path: "/", // Available site-wide
    maxAge: maxAgeSeconds, // Expires after DEMO_TTL_MINUTES
  });
}

/**
 * Checks if the demo mode cookie exists.
 * 
 * @param cookies - Next.js cookies instance from `await cookies()`
 * @returns true if demo cookie exists, false otherwise
 * 
 * @example
 * ```typescript
 * import { cookies } from "next/headers";
 * import { hasDemoCookie } from "@/lib/demo/demo-cookie";
 * 
 * const cookieStore = await cookies();
 * if (hasDemoCookie(cookieStore)) {
 *   // User is in demo mode
 * }
 * ```
 */
export function hasDemoCookie(
  cookieStore: CookieStore
): boolean {
  const cookie = cookieStore.get(DEMO_COOKIE);
  
  // Cookie exists if it's present and has a truthy value
  return cookie !== undefined && cookie.value !== undefined && cookie.value.length > 0;
}

/**
 * Clears the demo mode cookie.
 * 
 * Effectively removes demo mode by deleting the cookie.
 * 
 * @param cookies - Next.js cookies instance from `await cookies()`
 * 
 * @example
 * ```typescript
 * import { cookies } from "next/headers";
 * import { clearDemoCookie } from "@/lib/demo/demo-cookie";
 * 
 * const cookieStore = await cookies();
 * clearDemoCookie(cookieStore);
 * ```
 */
export function clearDemoCookie(
  cookieStore: CookieStore | { delete: (name: string) => void }
): void {
  // Delete the cookie
  cookieStore.delete(DEMO_COOKIE);
}

