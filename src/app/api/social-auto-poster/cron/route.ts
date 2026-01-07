import { NextRequest, NextResponse } from "next/server";
import { runDuePosts } from "@/lib/apps/social-auto-poster/runDuePosts";
import { isLikelyVercelCron } from "@/lib/apps/social-auto-poster/vercelCronVerification";

/**
 * GET /api/social-auto-poster/cron
 * POST /api/social-auto-poster/cron
 * 
 * Vercel Cron endpoint for processing scheduled posts.
 * Protected by verifying that requests come from Vercel's cron service.
 * 
 * This endpoint is called automatically by Vercel Cron (configured in vercel.json).
 * It does NOT require CRON_SECRET because it verifies requests are from Vercel infrastructure.
 * 
 * For manual testing or external cron services, use /api/social-auto-poster/runner instead.
 */
export async function GET(request: NextRequest) {
  // Block demo mode - background jobs should not run in demo
  const { isDemoRequest } = await import("@/lib/demo/assert-not-demo");
  if (isDemoRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "DEMO_READ_ONLY", message: "Demo Mode is view-only." },
      { status: 403 }
    );
  }
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  try {
    // Verify request is from Vercel Cron
    if (!isLikelyVercelCron(request.headers)) {
      return NextResponse.json(
        { ok: false, error: "unauthorized_cron" },
        { status: 401 }
      );
    }

    // Process due posts
    const result = await runDuePosts();

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Cron] Fatal error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

