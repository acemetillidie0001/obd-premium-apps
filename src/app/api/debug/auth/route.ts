import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Debug endpoint for authentication flow troubleshooting
 * 
 * ONLY available in development/staging environments.
 * Returns safe debug information (no secrets, no sensitive data).
 * 
 * Usage:
 * - Visit /api/debug/auth in browser
 * - Returns JSON with session status, route info, matcher hit status
 */

export async function GET(request: NextRequest) {
  // Only allow in development/staging (block production)
  // Use toString() to avoid TypeScript type narrowing issues
  const isProd = process.env.NODE_ENV?.toString() === "production";
  if (isProd) {
    return NextResponse.json(
      { error: "Debug endpoint not available in production" },
      { status: 403 }
    );
  }

  try {
    const session = await auth();
    const url = request.nextUrl;
    
    // Check if route would be matched by middleware
    const matcher = ["/", "/apps/:path*"];
    const pathname = url.pathname;
    const matcherHit = 
      pathname === "/" || 
      pathname.startsWith("/apps/");

    // Check for session cookie (safe - just checking presence, not reading value)
    // Check both possible cookie names without branching
    const cookiePresent =
      request.cookies.has("__Secure-next-auth.session-token") ||
      request.cookies.has("next-auth.session-token");

    return NextResponse.json({
      hasSession: !!session?.user,
      sessionUser: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        isPremium: session.user.isPremium,
      } : null,
      route: {
        pathname: pathname,
        search: url.search,
        fullPath: pathname + url.search,
      },
      middleware: {
        matcherHit: matcherHit,
        matcherPatterns: matcher,
      },
      cookies: {
        sessionCookiePresent: cookiePresent,
        checkedCookieNames: ["__Secure-next-auth.session-token", "next-auth.session-token"],
        allCookieNames: Array.from(request.cookies.getAll().map(c => c.name)),
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasAuthUrl: !!(process.env.AUTH_URL || process.env.NEXTAUTH_URL),
        hasAuthSecret: !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
        hasCookieDomain: !!process.env.AUTH_COOKIE_DOMAIN,
        cookieDomain: process.env.AUTH_COOKIE_DOMAIN || "not set",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Debug endpoint error",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

