/**
 * Demo Mode Exit Route Handler
 * 
 * Clears the demo mode cookie and redirects to /apps on the canonical host (production)
 * or current host (development).
 * This route disables demo mode for users visiting /apps/demo/exit.
 * 
 * Note: Cookies can only be modified in Route Handlers, not Server Components.
 */

import { NextRequest, NextResponse } from "next/server";
import { clearDemoCookie } from "@/lib/demo/demo-cookie";

export async function GET(request: NextRequest) {
  // In production, always redirect to canonical apps host to ensure cookie is cleared on same origin
  // In development, use request.url to stay on current host (works for any subdomain)
  const PROD_APPS_BASE = "https://apps.ocalabusinessdirectory.com";
  
  const redirectUrl =
    process.env.NODE_ENV === "production"
      ? new URL("/apps", PROD_APPS_BASE)
      : new URL("/apps", request.url);
  
  // Create redirect response and clear cookie on that response
  // This ensures the cookie is cleared on the canonical host in production
  const response = NextResponse.redirect(redirectUrl);
  
  // Clear demo cookie on the redirect response using shared helper
  // This ensures proper domain/path configuration (same as when setting) for proper deletion
  clearDemoCookie(response.cookies);
  
  return response;
}

