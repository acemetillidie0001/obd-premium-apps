import { NextResponse } from "next/server";
import { computeAnalyticsSummary } from "@/lib/apps/social-auto-poster/utils";
import { hasPremiumAccess } from "@/lib/premium";
import type { AnalyticsSummary } from "@/lib/apps/social-auto-poster/types";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant } from "@/lib/auth/tenant";

/**
 * GET /api/social-auto-poster/analytics
 * 
 * Returns analytics summary for the authenticated user.
 */
export async function GET() {
  try {
    const { userId } = await requireTenant();

    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Premium access required" },
        { status: 403 }
      );
    }

    const analytics = await computeAnalyticsSummary(userId);

    return NextResponse.json({ analytics } as { analytics: AnalyticsSummary });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error computing analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute analytics" },
      { status: 500 }
    );
  }
}

