/**
 * Edge-safe middleware for protecting /apps routes and homepage
 * 
 * Verification checklist:
 * - Visiting / should redirect to /login when logged out
 * - Visiting /login should work without 500 (not matched by middleware)
 * - Visiting /apps should redirect to /login when logged out
 * - After login, / and /apps load successfully
 * 
 * IMPORTANT: This middleware uses ONLY Edge-compatible APIs.
 * Do NOT import Prisma, NextAuth config, or env validation modules here.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  // Defensive: Check if auth secret is missing (supports both AUTH_SECRET and NEXTAUTH_SECRET)
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "missing_secret");
    return NextResponse.redirect(url);
  }

  try {
    const token = await getToken({
      req,
      secret,
    });

    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      // Set callbackUrl to the original path (including "/" for homepage)
      const callbackPath = req.nextUrl.pathname === "/" ? "/" : req.nextUrl.pathname + req.nextUrl.search;
      url.searchParams.set("callbackUrl", callbackPath);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch (error) {
    // Defensive: If token check fails, redirect to login with error
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "auth_error");
    return NextResponse.redirect(url);
  }
}

export const config = {
  // Protect homepage and all /apps routes
  // Note: /login and /api/auth/* are automatically excluded (not in matcher)
  matcher: [
    "/",
    "/apps/:path*",
  ],
};
