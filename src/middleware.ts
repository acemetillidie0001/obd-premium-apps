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

export default async function middleware(req: NextRequest) {
  try {
    const nextUrl = req.nextUrl;
    const pathname = nextUrl.pathname;
    
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
    const isAppsRoute = pathname === "/apps" || pathname.startsWith("/apps/");
    
    if (isAppsRoute) {
      const demo = req.cookies.get("obd_demo")?.value;
      if (demo && demo !== "") {
        // Demo cookie present + apps route = allow without auth (bypass login redirect)
        return NextResponse.next();
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

    // Protected route without session - redirect to login
    // Build callbackUrl from pathname and search params
    const callbackUrl = pathname + (nextUrl.search || "");
    
    const url = nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", callbackUrl);
    
    return NextResponse.redirect(url);
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
  // Robust matcher excludes:
  // - /login and /login/* (login pages)
  // - /api/auth/* (NextAuth API routes)
  // - /_next/* (Next.js internals)
  // - /favicon.ico (favicon)
  // - Any static files with extensions (.png, .svg, .jpg, .css, .js, etc.)
  // This ensures static assets are NEVER intercepted by middleware
  matcher: [
    "/((?!login|api/auth|_next|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json|woff|woff2|ttf|eot)).*)",
  ],
};
