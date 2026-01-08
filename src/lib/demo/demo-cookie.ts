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
 * - domain: ".ocalabusinessdirectory.com" in production (works across subdomains)
 */

import { cookies } from "next/headers";
import { DEMO_TTL_MINUTES } from "./demo-constants";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Cookie name used for demo mode.
 */
export const DEMO_COOKIE = "obd_demo";

/**
 * Gets the shared cookie options for demo mode.
 * 
 * Returns cookie configuration that ensures the cookie works across subdomains
 * in production (e.g., ocalabusinessdirectory.com and apps.ocalabusinessdirectory.com).
 * 
 * @param maxAgeSeconds - Cookie expiration in seconds (optional, defaults to DEMO_TTL_MINUTES)
 * @returns Cookie options object
 */
export function getDemoCookieOptions(maxAgeSeconds?: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  domain?: string;
} {
  const isProduction = process.env.NODE_ENV === "production";
  const maxAge = maxAgeSeconds ?? DEMO_TTL_MINUTES * 60;
  
  const options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
    domain?: string;
  } = {
    httpOnly: true, // Prevent JavaScript access (XSS protection)
    secure: isProduction, // HTTPS only in production
    sameSite: "lax", // CSRF protection while allowing top-level navigation
    path: "/", // Available site-wide
    maxAge, // Expiration time
  };
  
  // Set domain to parent domain in production for subdomain support
  // e.g., .ocalabusinessdirectory.com works for apps.ocalabusinessdirectory.com
  if (isProduction) {
    options.domain = ".ocalabusinessdirectory.com";
  }
  
  return options;
}

/**
 * Sets the demo mode cookie.
 * 
 * Cookie configuration:
 * - httpOnly: true (prevents XSS attacks)
 * - secure: true in production (HTTPS only), false in development
 * - sameSite: "lax" (CSRF protection while allowing top-level navigation)
 * - path: "/" (available on all routes)
 * - domain: ".ocalabusinessdirectory.com" in production (works across subdomains)
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
  const options = getDemoCookieOptions();
  cookieStore.set(DEMO_COOKIE, "1", options);
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
 * Uses the same domain and path as when setting to ensure proper deletion.
 * 
 * @param cookies - Next.js cookies instance from `await cookies()` or NextResponse cookies
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
  cookieStore: CookieStore | { delete: (name: string) => void; set: (name: string, value: string, options?: any) => void }
): void {
  // To properly clear a cookie, we need to set it with the same domain and path
  // but with an empty value and maxAge: 0
  // Use the same options as when setting (including domain) to ensure it's cleared correctly
  const options = getDemoCookieOptions(0);
  
  // Check if cookieStore has a set method (NextResponse cookies) or delete method (Next.js cookies)
  const hasSetMethod = "set" in cookieStore && typeof (cookieStore as any).set === "function";
  
  if (hasSetMethod) {
    // Use set with empty value and maxAge 0 to clear the cookie
    (cookieStore as { set: (name: string, value: string, options?: any) => void }).set(DEMO_COOKIE, "", {
      ...options,
      maxAge: 0, // Immediately expire
    });
  } else {
    // Fallback to delete if set is not available (Next.js cookies())
    (cookieStore as { delete: (name: string) => void }).delete(DEMO_COOKIE);
  }
}

