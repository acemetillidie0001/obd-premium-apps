/**
 * Demo Mode Entry Route Handler
 * 
 * Sets the demo mode cookie if it's missing, then redirects to the apps dashboard.
 * This route enables demo mode for users visiting /apps/demo.
 * 
 * Note: Cookies can only be modified in Route Handlers, not Server Components.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasDemoCookie, setDemoCookie, DEMO_COOKIE } from "@/lib/demo/demo-cookie";
import { DEMO_TTL_MINUTES } from "@/lib/demo/demo-constants";

export async function GET(request: NextRequest) {
  // Get cookies instance
  const cookieStore = await cookies();
  
  // Check if demo cookie already exists
  if (!hasDemoCookie(cookieStore)) {
    // Set demo cookie if it's missing
    setDemoCookie(cookieStore);
  }
  
  // Create redirect response and explicitly set cookie in response headers
  // This ensures the cookie is set even on redirect (belt-and-suspenders approach)
  const redirectUrl = new URL("/apps", request.url);
  const response = NextResponse.redirect(redirectUrl);
  
  // Explicitly set cookie in redirect response to ensure it's sent
  const maxAgeSeconds = DEMO_TTL_MINUTES * 60;
  const isProduction = process.env.NODE_ENV === "production";
  
  response.cookies.set(DEMO_COOKIE, "1", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/", // Critical: must be "/" for site-wide availability
    maxAge: maxAgeSeconds,
  });
  
  return response;
}

