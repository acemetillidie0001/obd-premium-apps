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
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/apps/:path*"],
};
