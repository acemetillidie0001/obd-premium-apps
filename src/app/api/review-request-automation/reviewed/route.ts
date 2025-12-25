import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReviewRequestStatus } from "@prisma/client";
import { verifyQueueItemToken } from "@/lib/apps/review-request-automation/token";

/**
 * GET /api/review-request-automation/reviewed
 * 
 * Tracks when a customer confirms they left a review.
 * Updates queue item status to REVIEWED and redirects to Reputation Dashboard.
 * 
 * Query params:
 * - token: Signed token containing queueItemId
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Verify token and extract queue item ID
    const queueItemId = verifyQueueItemToken(token);
    if (!queueItemId) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      );
    }

    // Fetch queue item
    const queueItem = await prisma.reviewRequestQueueItem.findUnique({
      where: { id: queueItemId },
    });

    if (!queueItem) {
      return NextResponse.json(
        { error: "Queue item not found" },
        { status: 404 }
      );
    }

    // Update status to REVIEWED if not already reviewed
    if (queueItem.status !== ReviewRequestStatus.REVIEWED) {
      await prisma.reviewRequestQueueItem.update({
        where: { id: queueItemId },
        data: {
          status: ReviewRequestStatus.REVIEWED,
          reviewedAt: new Date(),
          // Also set clickedAt if not already set
          clickedAt: queueItem.clickedAt || new Date(),
        },
      });
    }

    // Redirect to Reputation Dashboard with from=rra parameter
    const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://apps.ocalabusinessdirectory.com";
    const redirectUrl = `${baseUrl}/apps/reputation-dashboard?from=rra`;

    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error("Error in reviewed tracking:", error);
    return NextResponse.json(
      {
        error: "Failed to process reviewed tracking",
      },
      { status: 500 }
    );
  }
}

