import { NextRequest, NextResponse } from "next/server";
import { runDuePosts } from "@/lib/apps/social-auto-poster/runDuePosts";

/**
 * POST /api/social-auto-poster/runner
 * GET /api/social-auto-poster/runner
 * 
 * Background runner for processing scheduled posts.
 * Protected by CRON_SECRET env var.
 * 
 * Authentication:
 * - Query param: ?secret=YOUR_CRON_SECRET (recommended)
 * - Header: x-cron-secret: YOUR_CRON_SECRET (alternative)
 * 
 * Intended for:
 * - Manual testing via curl or HTTP client
 * - External cron services that can send secrets
 * 
 * For Vercel Cron (automatic), use /api/social-auto-poster/cron instead.
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    // Verify CRON_SECRET is configured
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { ok: false, error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }

    // Check secret from header or query param
    const providedSecret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
    
    if (!providedSecret || providedSecret !== cronSecret) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Process due posts using shared logic
    const result = await runDuePosts();

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Runner] Fatal error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social-auto-poster/runner
 * 
 * Same as POST, but allows triggering via GET with secret query param.
 * Useful for manual testing.
 */
export async function GET(request: NextRequest) {
  // Delegate to POST handler
  return POST(request);
}

