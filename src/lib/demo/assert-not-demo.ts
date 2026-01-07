/**
 * Demo Mode Request Assertion
 * 
 * CRITICAL SECURITY: Blocks all database writes and mutations in demo mode.
 * Demo mode must be truly read-only - no saves, updates, deletes, or creates.
 * 
 * This file is server-only and safe for route handlers.
 * Do not use URL params - demo detection is cookie-based only.
 */

import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE } from "./demo-cookie";

/**
 * Gets the demo cookie name.
 * 
 * @returns The demo cookie name string ("obd_demo")
 */
function getDemoCookieName(): string {
  return DEMO_COOKIE;
}

/**
 * Checks if the request is in demo mode.
 * 
 * @param req - Next.js request object
 * @returns true if the demo cookie is present, false otherwise
 * 
 * @example
 * ```typescript
 * if (isDemoRequest(request)) {
 *   // Handle demo mode
 * }
 * ```
 */
export function isDemoRequest(req: NextRequest): boolean {
  // Check for demo cookie in request
  const demoCookie = req.cookies.get(getDemoCookieName());
  
  // Return true if cookie exists and has a non-empty value
  return demoCookie !== undefined && 
         demoCookie.value !== undefined && 
         demoCookie.value.length > 0;
}

/**
 * Asserts that the request is NOT in demo mode.
 * 
 * If demo mode is active, returns a standardized 403 Forbidden response with JSON error.
 * Otherwise returns null (request can proceed).
 * 
 * CRITICAL: Call this at the TOP of all mutation handlers (POST/PUT/PATCH/DELETE)
 * before any business logic or database operations.
 * 
 * This function does NOT throw errors - it returns a Response that should be returned
 * from the route handler.
 * 
 * @param req - Next.js request object
 * @returns NextResponse with 403 status if demo mode is active, null otherwise
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   // Block demo mode mutations
 *   const demoBlock = assertNotDemoRequest(request);
 *   if (demoBlock) return demoBlock;
 *   
 *   // ... rest of handler
 * }
 * ```
 */
export function assertNotDemoRequest(req: NextRequest): NextResponse | null {
  // Check if request is in demo mode
  if (isDemoRequest(req)) {
    // Return standardized 403 response
    return NextResponse.json(
      {
        error: "DEMO_READ_ONLY",
        message: "Demo Mode is view-only.",
      },
      { status: 403 }
    );
  }
  
  // No demo mode - request can proceed
  return null;
}

