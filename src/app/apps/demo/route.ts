/**
 * Demo Mode Entry Route Handler
 * 
 * Sets the demo mode cookie if it's missing, then redirects to the apps dashboard.
 * This route enables demo mode for users visiting /apps/demo.
 * 
 * Note: Cookies can only be modified in Route Handlers, not Server Components.
 */

import { NextRequest, NextResponse } from "next/server";
import { setDemoCookie } from "@/lib/demo/demo-cookie";

export async function GET(request: NextRequest) {
  // In production, always redirect to canonical apps host to ensure cookie is set on same origin
  // In development, use request.url to stay on current host (works for any subdomain)
  const PROD_APPS_BASE = "https://apps.ocalabusinessdirectory.com";
  
  const redirectUrl =
    process.env.NODE_ENV === "production"
      ? new URL("/apps", PROD_APPS_BASE)
      : new URL("/apps", request.url);
  
  // Create redirect response and set cookie on that response
  // This ensures the cookie is set on the canonical host in production
  const response = NextResponse.redirect(redirectUrl);
  
  // Set demo cookie on the redirect response using shared helper
  // This ensures proper domain/path configuration for cross-subdomain support
  setDemoCookie(response.cookies);
  
  return response;
}

