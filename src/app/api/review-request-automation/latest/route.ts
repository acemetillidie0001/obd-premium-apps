import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/review-request-automation/latest
 * 
 * Returns the most recent Review Request Automation campaign for the authenticated user.
 * 
 * Returns:
 * - 401 if not authenticated
 * - 200 with { campaign: null } if no campaign exists
 * - 200 with { campaign } if campaign exists
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Query for the latest campaign, strictly scoped by userId
    const campaign = await prisma.reviewRequestCampaign.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    // Return 200 with null if no campaign exists (not 404)
    // This prevents warning banners for first-time users
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Error in latest campaign route:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch latest campaign",
      },
      { status: 500 }
    );
  }
}
