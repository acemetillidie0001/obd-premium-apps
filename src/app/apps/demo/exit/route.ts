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
import { clearDemoCookie } from "@/lib/demo/demo-cookie";

export async function GET(request: NextRequest) {
  // Get cookies instance
  const cookieStore = await cookies();
  
  // Clear the demo cookie
  clearDemoCookie(cookieStore);
  
  // Redirect to external dashboard preview page
  return NextResponse.redirect("https://ocalabusinessdirectory.com/premium/dashboard-preview/");
}

