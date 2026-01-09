/**
 * TEMPORARY DEBUG ENDPOINT - Demo Cookie Detection Proof
 * 
 * ⚠️ WARNING: This is a temporary diagnostic endpoint.
 * MUST BE REMOVED after demo cookie verification is complete.
 * 
 * This endpoint shows how the middleware detects the demo cookie
 * using raw cookie header parsing (same logic as middleware).
 * 
 * Route: GET /apps/demo/proof
 * Access: Public (no auth required)
 * Runtime: Edge (for consistency with middleware)
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * Check if demo mode cookie is present in request
 * Use raw Cookie header for Edge reliability
 * 
 * This is the EXACT same function used in middleware.ts
 */
function hasDemoCookie(req: NextRequest): boolean {
  const cookieHeader = req.headers.get("cookie") || "";
  
  // Simple check: does the cookie header contain "obd_demo=" followed by a non-empty value
  // This handles all cookie formats: obd_demo=1, obd_demo=1;, ; obd_demo=1, etc.
  const demoCookiePattern = /(?:^|;\s*)obd_demo\s*=\s*([^;]+)/;
  const match = cookieHeader.match(demoCookiePattern);
  
  if (!match || !match[1]) {
    return false;
  }
  
  const value = match[1].trim();
  // Cookie value should be "1" or any non-empty truthy value
  // Accept "1", "true", or any non-empty string (but reject "0", "false", empty)
  return value.length > 0 && value !== "0" && value !== "false" && value !== "";
}

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";
  const host = request.headers.get("host") || "unknown";
  const pathname = request.nextUrl.pathname;
  
  // Use the exact same helper as middleware
  const parsedHasDemoCookie = hasDemoCookie(request);
  
  // Simple string includes check (for comparison)
  const hasObdDemoInCookieHeader = cookieHeader.includes("obd_demo");
  
  const response = {
    host,
    pathname,
    cookieHeaderLength: cookieHeader.length,
    hasObdDemoInCookieHeader,
    parsedHasDemoCookie,
    timestamp: new Date().toISOString(),
    // Vercel deployment identity fields
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    vercelRegion: process.env.VERCEL_REGION || null,
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    buildId: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null,
  };
  
  const jsonResponse = NextResponse.json(response);
  
  // Prevent CDN caching - this is a diagnostic endpoint
  jsonResponse.headers.set("Cache-Control", "no-store, max-age=0");
  jsonResponse.headers.set("Pragma", "no-cache");
  
  return jsonResponse;
}

