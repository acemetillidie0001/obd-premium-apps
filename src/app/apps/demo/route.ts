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
import { hasDemoCookie, setDemoCookie, getDemoCookieOptions, DEMO_COOKIE } from "@/lib/demo/demo-cookie";

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
  // Use request.url to stay on current host (works for any subdomain)
  // new URL("/apps", request.url) ensures redirect stays on same host as request
  const redirectUrl = new URL("/apps", request.url);
  const response = NextResponse.redirect(redirectUrl);
  
  // Use shared cookie options (includes domain for cross-subdomain support in production)
  // Options: path: "/", httpOnly: true, sameSite: "lax", secure: true (production),
  // domain: ".ocalabusinessdirectory.com" (production only)
  const cookieOptions = getDemoCookieOptions();
  
  // Explicitly set cookie on the same NextResponse that performs the redirect
  // This ensures the cookie is sent with the redirect response
  // Uses same domain and path as setDemoCookie for consistency
  response.cookies.set(DEMO_COOKIE, "1", cookieOptions);
  
  return response;
}

