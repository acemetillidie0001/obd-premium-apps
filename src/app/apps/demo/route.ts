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
import { hasDemoCookie, setDemoCookie } from "@/lib/demo/demo-cookie";

export async function GET(request: NextRequest) {
  // Get cookies instance
  const cookieStore = await cookies();
  
  // Check if demo cookie already exists
  if (!hasDemoCookie(cookieStore)) {
    // Set demo cookie if it's missing
    setDemoCookie(cookieStore);
  }
  
  // Redirect to apps dashboard
  return NextResponse.redirect(new URL("/apps", request.url));
}

