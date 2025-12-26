import { NextResponse } from "next/server";

/**
 * GET /api/health
 * 
 * Diagnostic endpoint to verify deployment information.
 * Returns environment variables and build metadata.
 * Safe to call - no secrets exposed.
 */
export async function GET() {
  const vercelEnv = process.env.VERCEL_ENV || "unknown";
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_COMMIT_SHA || "unknown";
  const nodeEnv = process.env.NODE_ENV || "unknown";
  
  // Build time from environment or fallback
  const buildTime = process.env.VERCEL ? 
    (process.env.VERCEL_BUILD_TIME || new Date().toISOString()) :
    new Date().toISOString();

  return NextResponse.json({
    ok: true,
    vercelEnv,
    commitSha,
    buildTime,
    nodeEnv,
    timestamp: new Date().toISOString(),
  });
}

