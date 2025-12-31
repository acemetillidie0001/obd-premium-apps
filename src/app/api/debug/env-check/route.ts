/**
 * Environment Check Debug Endpoint
 * 
 * Local-only endpoint to verify environment variables are loaded correctly.
 * Does NOT expose secrets - only reports presence/absence of critical vars.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/debug/env-check
 * Returns environment variable status (no secrets exposed)
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV || "undefined",
    // Do NOT include the actual DATABASE_URL value (security)
  });
}
