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
 * HARDENED: Single negative-lookahead matcher ensures /login is NEVER matched.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Type for the request parameter in NextAuth middleware callback
// NextAuth's auth() adds an 'auth' property to NextRequest containing the session
type AuthRequest = NextRequest & {
  auth: {
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
  const { auth: session, nextUrl } = req;
  const { pathname } = nextUrl;
  
  // CRITICAL SAFEGUARD: Never process /login or /login/* paths
  // This should never execute due to matcher exclusion, but adding as defense-in-depth
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth") || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  
  // If user is authenticated, ALWAYS allow access (never redirect to /login)
  if (session?.user) {
    return NextResponse.next();
  }

  // User is not authenticated - check if this is a protected route
  // Only redirect "/" and "/apps/*" routes to login
  const isProtectedRoute = pathname === "/" || pathname.startsWith("/apps");
  
  if (!isProtectedRoute) {
    // Not a protected route, allow through
    return NextResponse.next();
  }

  // Protected route without session - redirect to login
  // Build callbackUrl from pathname and search params
  // URLSearchParams.set() will automatically encode the value
  const callbackUrl = pathname + (nextUrl.search || "");
  
  const url = new URL("/login", nextUrl.origin);
  url.searchParams.set("callbackUrl", callbackUrl);
  
  return NextResponse.redirect(url);
});

export const config = {
  // Single negative-lookahead matcher excludes:
  // - /login and /login/* (login pages - CRITICAL to prevent redirect loops)
  // - /api/auth/* (NextAuth API routes)
  // - /_next/* (Next.js internals)
  // - /favicon.ico (favicon)
  // Pattern ensures /login is NEVER matched by middleware
  matcher: ["/((?!login|api/auth|_next|favicon.ico).*)"],
};
