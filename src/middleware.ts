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
 */
function hasDemoCookie(req: NextRequest): boolean {
  const cookieHeader = req.headers.get("cookie") || "";
  
  // Simple check: does the cookie header contain "obd_demo=" followed by a non-empty value
  // This handles all cookie formats: obd_demo=1, obd_demo=1;, ; obd_demo=1, etc.
  const demoCookiePattern = /(?:^|;\s*)obd_demo\s*=\s*([^;]+)/;
  const match = cookieHeader.match(demoCookiePattern);
  
  if (!match || !match[1]) {
    return false;
  }
  
  const value = match[1].trim();
  // Cookie value should be "1" or any non-empty truthy value
  // Accept "1", "true", or any non-empty string (but reject "0", "false", empty)
  return value.length > 0 && value !== "0" && value !== "false" && value !== "";
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
        const url = nextUrl.clone();
        url.host = CANONICAL_APPS_HOST;
        url.protocol = "https:";
        return NextResponse.redirect(url);
      }
    }
    
    // DEMO MODE: Allow public demo entry routes (must check BEFORE auth)
    // These routes set/clear the demo cookie and should never require auth
    const isDemoEntry = pathname === "/apps/demo" || pathname.startsWith("/apps/demo/");
    
    if (isDemoEntry) {
      // Always allow demo entry/exit routes - they handle their own cookie logic
      return NextResponse.next();
    }
    
    // DEMO MODE: Allow /apps and /apps/:path* routes when demo cookie is present
    // This enables view-only demo access without requiring login
    // Check for demo cookie explicitly - must exist and have a non-empty value
    // Pattern matches: /apps, /apps/anything, /apps/nested/anything, etc.
    // Note: isAppsRoute is already defined above for canonical host check
    
    if (isAppsRoute) {
      const hasDemo = hasDemoCookie(req);
      const cookieHeader = req.headers.get("cookie") || "";
      
      // Add debug header to see what middleware sees (temporary)
      if (hasDemo) {
        // Demo cookie present + apps route = allow without auth (bypass login redirect)
        const response = NextResponse.next();
        response.headers.set("x-debug-demo-detected", "1");
        response.headers.set("x-debug-cookie-length", String(cookieHeader.length));
        return response;
      } else {
        // Debug: log when demo cookie is NOT detected for apps routes
        // This will help diagnose why redirects happen
      }
    }
    
    // CRITICAL: Only protect "/" and "/apps" (including "/apps/*") routes
    // Everything else must pass through immediately
    const isProtectedRoute = pathname === "/" || pathname.startsWith("/apps");
    
    if (!isProtectedRoute) {
      // Not a protected route, allow through immediately
      return NextResponse.next();
    }
    
    // Protected route - check authentication using getToken (Edge-safe)
    const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    
    if (!authSecret) {
      // No secret configured, fail open (allow access)
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Middleware] AUTH_SECRET not configured, allowing access");
      }
      return NextResponse.next();
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
      return NextResponse.next();
    }

    // Protected route without session - check demo mode before redirecting
    // DEMO MODE BYPASS: If demo cookie is present, allow access (read-only mode)
    // This ensures demo mode users can access protected routes without authentication
    const hasDemo = hasDemoCookie(req);
    if (hasDemo) {
      // Demo cookie present - allow access without auth (bypass login redirect)
      // This enables view-only demo access to protected routes
      return NextResponse.next();
    }

    // Protected route without session and no demo cookie - redirect to login
    // Build callbackUrl from pathname and search params
    const callbackUrl = pathname + (nextUrl.search || "");
    
    const url = nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", callbackUrl);
    
    // TEMPORARY DEBUG: Add headers to help diagnose cookie detection issues
    const cookieHeader = req.headers.get("cookie") || "";
    const hasDemoInHeader = cookieHeader.includes("obd_demo");
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set("x-debug-cookie-header-length", String(cookieHeader.length));
    redirectResponse.headers.set("x-debug-has-obd-demo-in-header", hasDemoInHeader ? "1" : "0");
    redirectResponse.headers.set("x-debug-pathname", pathname);
    redirectResponse.headers.set("x-debug-host", req.headers.get("host") || "unknown");
    
    return redirectResponse;
  } catch (error) {
    // FAIL OPEN: If anything errors, allow the request through
    // Log error in development only (production logs should be minimal)
    if (process.env.NODE_ENV !== "production") {
      console.error("[Middleware] Error in middleware, failing open:", error);
    }
    return NextResponse.next();
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
