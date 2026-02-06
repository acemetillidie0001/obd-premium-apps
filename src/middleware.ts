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

function getFirstPathSegment(pathname: string): string {
  // "/foo/bar" -> "foo"
  const seg = pathname.split("/")[1];
  return seg ?? "";
}

const PUBLIC_FIRST_SEGMENTS = new Set<string>([
  // Auth
  "login",
  // Public / informational
  "help",
  "help-center",
  "data-deletion",
  // Public widget + booking flows
  "widget",
  "book",
]);

type AuthTokenResult = { token: unknown | null; hasAuthSecret: boolean };

async function getAuthTokenEdgeSafe(req: NextRequest): Promise<AuthTokenResult> {
  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!authSecret) {
    // Fail open if not configured (consistent with prior hardened behavior).
    return { token: null, hasAuthSecret: false };
  }

  // Try default first, then fall back to known cookie name variants
  const cookieNames = [
    undefined, // default (let getToken determine)
    "__Secure-authjs.session-token",
    "authjs.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.session-token",
  ];

  for (const cookieName of cookieNames) {
    try {
      const token = await getToken({
        req,
        secret: authSecret,
        ...(cookieName && { cookieName }),
      });
      if (token) return { token, hasAuthSecret: true };
    } catch {
      // continue to next cookie variant
    }
  }

  return { token: null, hasAuthSecret: true };
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

    const hasDemo = hasDemoCookie(req);
    const isDemoNamespace = pathname === "/apps" || pathname.startsWith("/apps/");

    // PREMIUM ROUTES: "/" and "/<tool-slug>(/*)"
    const firstSegment = getFirstPathSegment(pathname);
    const isPremiumDashboard = pathname === "/";
    const isPremiumTool = !!firstSegment && !PUBLIC_FIRST_SEGMENTS.has(firstSegment);
    const isPremiumRoute = isPremiumDashboard || isPremiumTool;

    // DEMO NAMESPACE ROUTES: /apps and /apps/*
    // - If authenticated AND not demo-mode: redirect to Premium canonical URL (strip "/apps")
    // - Otherwise: allow (demo/unauth stays on /apps)
    if (isDemoNamespace) {
      if (!hasDemo) {
        const { token, hasAuthSecret } = await getAuthTokenEdgeSafe(req);
        if (hasAuthSecret && token) {
          const url = nextUrl.clone();
          if (pathname === "/apps") {
            url.pathname = "/";
          } else if (pathname.startsWith("/apps/apps/")) {
            url.pathname = pathname.replace(/^\/apps\/apps\//, "/");
          } else {
            url.pathname = pathname.replace(/^\/apps\//, "/");
          }
          return NextResponse.redirect(url);
        }
      }

      const response = NextResponse.next();
      addDeployShaHeader(response, pathname);
      return response;
    }

    // Not demo namespace
    if (!isPremiumRoute) {
      // Not a Premium tool/dashboard route; allow through without auth changes.
      return NextResponse.next();
    }

    // Demo-mode users should stay on /apps (demo-only).
    if (hasDemo) {
      const url = nextUrl.clone();
      url.pathname = pathname === "/" ? "/apps" : `/apps${pathname}`;
      return NextResponse.redirect(url);
    }

    // Premium route: require authentication.
    const { token, hasAuthSecret } = await getAuthTokenEdgeSafe(req);
    if (!hasAuthSecret) {
      // Fail open if auth secret is missing (don’t brick the site).
      if (pathname === "/") {
        return NextResponse.next();
      }
      const rewriteUrl = nextUrl.clone();
      rewriteUrl.pathname = `/apps${pathname}`;
      return NextResponse.rewrite(rewriteUrl);
    }

    if (!token) {
      // Redirect to login with callbackUrl to preserve intended destination
      const callbackUrl = pathname + (nextUrl.search || "");
      const url = nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(url);
    }

    // Authenticated premium dashboard: allow
    if (pathname === "/") {
      return NextResponse.next();
    }

    // Authenticated premium tool route: serve the existing /apps/* page tree without changing URL
    const rewriteUrl = nextUrl.clone();
    rewriteUrl.pathname = `/apps${pathname}`;
    return NextResponse.rewrite(rewriteUrl);
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
  // Run middleware for all non-static, non-API routes.
  // We keep all auth/redirect logic inside the middleware function so we can:
  // - protect Premium tools at "/<tool>" (canonical)
  // - keep Demo at "/apps/*" (demo-only)
  // - conditionally redirect "/apps/*" -> "/*" only when authenticated and not demo-mode
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
