import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { computeAnalyticsSummary } from "@/lib/apps/social-auto-poster/utils";
import type { AnalyticsSummary } from "@/lib/apps/social-auto-poster/types";

/**
 * GET /api/social-auto-poster/analytics
 * 
 * Returns analytics summary for the authenticated user.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const analytics = await computeAnalyticsSummary(userId);

    return NextResponse.json({ analytics } as { analytics: AnalyticsSummary });
  } catch (error) {
    console.error("Error computing analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute analytics" },
      { status: 500 }
    );
  }
}

