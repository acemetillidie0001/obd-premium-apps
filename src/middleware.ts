/**
 * Edge-safe middleware for protecting /apps routes
 * 
 * Verification checklist:
 * - Visiting / should work without login (not matched by middleware)
 * - Visiting /login should work without 500 (not matched by middleware)
 * - Visiting /apps should redirect to /login when logged out
 * - After login, /apps loads successfully
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
      url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
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
  matcher: ["/apps/:path*"],
};
