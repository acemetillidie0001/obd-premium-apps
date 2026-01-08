/**
 * Demo Mode Exit Route Handler
 * 
 * Clears the demo mode cookie and redirects to the external dashboard preview page.
 * This route disables demo mode for users visiting /apps/demo/exit.
 * 
 * Note: Cookies can only be modified in Route Handlers, not Server Components.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearDemoCookie, getDemoCookieOptions, DEMO_COOKIE } from "@/lib/demo/demo-cookie";

export async function GET(request: NextRequest) {
  // Get cookies instance
  const cookieStore = await cookies();
  
  // Clear the demo cookie
  clearDemoCookie(cookieStore);
  
  // Create redirect response and explicitly clear cookie in response headers
  // This ensures the cookie is cleared even on redirect (belt-and-suspenders approach)
  const response = NextResponse.redirect("https://ocalabusinessdirectory.com/premium/dashboard-preview/");
  
  // Use shared cookie options with maxAge 0 to clear the cookie
  // Must use same domain and path as when setting to ensure proper deletion
  const cookieOptions = getDemoCookieOptions(0);
  
  // Explicitly clear cookie in redirect response by setting empty value with maxAge 0
  response.cookies.set(DEMO_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0, // Immediately expire
  });
  
  return response;
}

