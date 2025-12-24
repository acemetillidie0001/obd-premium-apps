/**
 * Middleware for protecting /apps routes and homepage
 * 
 * Verification checklist:
 * - Visiting / should redirect to /login when logged out
 * - Visiting /login should work without 500 (not matched by middleware)
 * - Visiting /apps should redirect to /login when logged out
 * - After login, / and /apps load successfully
 * 
 * IMPORTANT: Uses NextAuth v5 auth() helper which handles cookie reading correctly.
 * This ensures middleware can read sessions even with custom cookie domain/names.
 * 
 * HARDENED: Matcher excludes static assets and auth routes. Fail-open on errors.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Type for the request parameter in NextAuth middleware callback
// NextAuth's auth() adds an 'auth' property to NextRequest containing the session
type AuthRequest = NextRequest & {
  auth?: {
    user?: {
      id?: string;
      email?: string | null;
      role?: string;
      isPremium?: boolean;
      name?: string | null;
      image?: string | null;
    } | null;
    expires?: string;
  } | null;
};

export default auth((req: AuthRequest) => {
  try {
    // Defensive: req.auth may be undefined, treat as null
    const session = req.auth || null;
    const nextUrl = req.nextUrl;
    const pathname = nextUrl.pathname;
    
    // CRITICAL: Only protect "/" and "/apps" (including "/apps/*") routes
    // Everything else must pass through immediately
    const isProtectedRoute = pathname === "/" || pathname.startsWith("/apps");
    
    if (!isProtectedRoute) {
      // Not a protected route, allow through immediately
      return NextResponse.next();
    }
    
    // Protected route - check authentication
    // If user is authenticated, allow access
    if (session?.user) {
      return NextResponse.next();
    }

    // Protected route without session - redirect to login
    // Build callbackUrl from pathname and search params
    const callbackUrl = pathname + (nextUrl.search || "");
    
    const url = new URL("/login", nextUrl.origin);
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
});

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
