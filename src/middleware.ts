/**
 * Middleware for protecting /apps routes and homepage
 * 
 * Edge-safe implementation using next-auth/jwt getToken().
 * Does NOT import @/lib/auth to avoid Node.js dependencies (Prisma, etc.).
 * 
 * Verification checklist:
 * - Visiting / should redirect to /login when logged out
 * - Visiting /login should work without 500 (not matched by middleware)
 * - Visiting /apps should redirect to /login when logged out
 * - After login, / and /apps load successfully
 * 
 * HARDENED: Matcher excludes static assets and auth routes. Fail-open on errors.
 * 
 * TODO: Next.js 16+ deprecates "middleware" convention in favor of "proxy".
 * This middleware handles auth/redirect logic (not just proxying), so migration
 * should be evaluated carefully to ensure auth behavior is preserved.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Check if demo mode cookie is present in request
 * Use raw Cookie header for Edge reliability
 * Presence-based detection: checks for "obd_demo" or "obd_demo=" in cookie string
 */
function hasDemoCookie(req: NextRequest): boolean {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return false;

  return cookieHeader
    .split(";")
    .some(c => {
      const v = c.trim();
      return v === "obd_demo" || v.startsWith("obd_demo=");
    });
}

/**
 * Add deployment SHA header to /apps responses
 * Temporary diagnostic header to verify which deployment is serving requests
 */
function addDeployShaHeader(response: NextResponse, pathname: string): void {
  if (pathname.startsWith("/apps")) {
    const deploySha = process.env.VERCEL_GIT_COMMIT_SHA || "unknown";
    response.headers.set("x-obd-deploy-sha", deploySha);
  }
}

export default async function middleware(req: NextRequest) {
  try {
    const nextUrl = req.nextUrl;
    const pathname = nextUrl.pathname;
    
    // CANONICAL HOST ENFORCEMENT: Redirect /apps routes to canonical host in production
    const CANONICAL_APPS_HOST = "apps.ocalabusinessdirectory.com";
    const isAppsRoute = pathname === "/apps" || pathname.startsWith("/apps/");
    
    if (process.env.NODE_ENV === "production" && isAppsRoute) {
      const host = nextUrl.host;
      if (host !== CANONICAL_APPS_HOST) {
        // Cookie detection using raw header parsing
        const cookieHeader = req.headers.get("cookie") ?? "";
        const hasObdDemoInHeader = cookieHeader.includes("obd_demo=");
        
        // Presence-based detection (matches hasDemoCookie logic)
        const parsedHasDemoCookie = cookieHeader
          .split(";")
          .some(c => {
            const v = c.trim();
            return v === "obd_demo" || v.startsWith("obd_demo=");
          });
        
        const url = nextUrl.clone();
        url.host = CANONICAL_APPS_HOST;
        url.protocol = "https:";
        const redirectResponse = NextResponse.redirect(url);
        const requestHost = req.headers.get("host") || "unknown";
        
        // Set diagnostic headers ONLY on canonical-host redirect response
        redirectResponse.headers.set("x-obd-mw", "redirect");
        redirectResponse.headers.set("x-obd-mw-reason", "canonical_host");
        redirectResponse.headers.set("x-obd-mw-host", requestHost);
        redirectResponse.headers.set("x-obd-mw-path", pathname);
        redirectResponse.headers.set("x-obd-mw-cookie-len", String(cookieHeader.length));
        redirectResponse.headers.set("x-obd-mw-cookie-has-obd-demo", hasObdDemoInHeader ? "1" : "0");
        redirectResponse.headers.set("x-obd-mw-parsed-has-demo", parsedHasDemoCookie ? "1" : "0");
        
        return redirectResponse;
      }
    }
    
    // DEMO MODE: Allow public demo entry routes (must check BEFORE auth)
    // These routes set/clear the demo cookie and should never require auth
    const isDemoEntry = pathname === "/apps/demo" || pathname.startsWith("/apps/demo/");
    
    if (isDemoEntry) {
      // Always allow demo entry/exit routes - they handle their own cookie logic
      const response = NextResponse.next();
      addDeployShaHeader(response, pathname);
      return response;
    }
    
    // DEMO MODE: Allow /apps and /apps/:path* routes when demo cookie is present
    // This enables view-only demo access without requiring login
    // Check for demo cookie explicitly - must exist and have a non-empty value
    // Pattern matches: /apps, /apps/anything, /apps/nested/anything, etc.
    // Note: isAppsRoute is already defined above for canonical host check
    
    if (isAppsRoute) {
      const hasDemo = hasDemoCookie(req);
      
      if (hasDemo) {
        // Demo cookie present + apps route = allow without auth (bypass login redirect)
        const response = NextResponse.next();
        addDeployShaHeader(response, pathname);
        return response;
      }
    }
    
    // CRITICAL: Only protect "/" and "/apps" (including "/apps/*") routes
    // Everything else must pass through immediately
    const isProtectedRoute = pathname === "/" || pathname.startsWith("/apps");
    
    if (!isProtectedRoute) {
      // Not a protected route, allow through immediately
      const response = NextResponse.next();
      addDeployShaHeader(response, pathname);
      return response;
    }
    
    // Protected route - check authentication using getToken (Edge-safe)
    const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    
    if (!authSecret) {
      // No secret configured, fail open (allow access)
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Middleware] AUTH_SECRET not configured, allowing access");
      }
      const response = NextResponse.next();
      addDeployShaHeader(response, pathname);
      return response;
    }
    
    // Try to get token with different cookie names for robustness
    // Try default first, then fallback to known cookie name variants
    const cookieNames = [
      undefined, // default (let getToken determine)
      "__Secure-authjs.session-token",
      "authjs.session-token",
      "__Secure-next-auth.session-token",
      "next-auth.session-token",
    ];
    
    let token = null;
    for (const cookieName of cookieNames) {
      try {
        token = await getToken({
          req,
          secret: authSecret,
          ...(cookieName && { cookieName }),
        });
        if (token) {
          break; // Found a valid token, stop trying
        }
      } catch (err) {
        // Continue to next cookie name if this one fails
        continue;
      }
    }
    
    // If we have a token, user is authenticated - allow access
    if (token) {
      const response = NextResponse.next();
      addDeployShaHeader(response, pathname);
      return response;
    }

    // Protected route without session - check demo mode before redirecting
    // DEMO MODE BYPASS: If demo cookie is present, allow access (read-only mode)
    // This ensures demo mode users can access protected routes without authentication
    const hasDemo = hasDemoCookie(req);
    if (hasDemo) {
      // Demo cookie present - allow access without auth (bypass login redirect)
      // This enables view-only demo access to protected routes
      const response = NextResponse.next();
      addDeployShaHeader(response, pathname);
      return response;
    }

    // Protected route without session and no demo cookie - redirect to login
    // Build callbackUrl from pathname and search params
    const callbackUrl = pathname + (nextUrl.search || "");
    
    // Cookie detection using raw header parsing
    const cookieHeader = req.headers.get("cookie") ?? "";
    const hasObdDemoInHeader = cookieHeader.includes("obd_demo=");
    
    // Presence-based detection (matches hasDemoCookie logic)
    const parsedHasDemoCookie = cookieHeader
      .split(";")
      .some(c => {
        const v = c.trim();
        return v === "obd_demo" || v.startsWith("obd_demo=");
      });
    
    const url = nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", callbackUrl);
    
    const redirectResponse = NextResponse.redirect(url);
    const host = req.headers.get("host") || "unknown";
    
    // Set diagnostic headers ONLY on redirect-to-login response
    redirectResponse.headers.set("x-obd-mw", "redirect");
    redirectResponse.headers.set("x-obd-mw-reason", "no_token_no_demo");
    redirectResponse.headers.set("x-obd-mw-host", host);
    redirectResponse.headers.set("x-obd-mw-path", pathname);
    redirectResponse.headers.set("x-obd-mw-cookie-len", String(cookieHeader.length));
    redirectResponse.headers.set("x-obd-mw-cookie-has-obd-demo", hasObdDemoInHeader ? "1" : "0");
    redirectResponse.headers.set("x-obd-mw-parsed-has-demo", parsedHasDemoCookie ? "1" : "0");
    
    return redirectResponse;
  } catch (error) {
    // FAIL OPEN: If anything errors, allow the request through
    // Log error in development only (production logs should be minimal)
    if (process.env.NODE_ENV !== "production") {
      console.error("[Middleware] Error in middleware, failing open:", error);
    }
    const response = NextResponse.next();
    // Get pathname from request URL in case it wasn't set earlier
    const errorPathname = req.nextUrl.pathname;
    addDeployShaHeader(response, errorPathname);
    return response;
  }
}

export const config = {
  // Explicit matcher: Only protect these routes
  // - "/" (homepage)
  // - "/apps" (apps dashboard)
  // - "/apps/:path*" (all nested app routes)
  // Middleware will NOT run for unrelated routes (login, API routes, static assets, etc.)
  matcher: ["/", "/apps", "/apps/:path*"],
};
