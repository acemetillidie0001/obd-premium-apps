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
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
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

