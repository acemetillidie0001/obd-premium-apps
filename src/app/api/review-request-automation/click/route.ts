import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReviewRequestStatus } from "@prisma/client";
import { verifyQueueItemToken } from "@/lib/apps/review-request-automation/token";

/**
 * GET /api/review-request-automation/click
 * 
 * Tracks when a customer clicks the review link in an email.
 * Updates queue item status to CLICKED and redirects to the actual review link.
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

    // Fetch queue item with campaign to get review link
    const queueItem = await prisma.reviewRequestQueueItem.findUnique({
      where: { id: queueItemId },
      include: {
        campaign: {
          select: {
            reviewLinkUrl: true,
          },
        },
      },
    });

    if (!queueItem) {
      return NextResponse.json(
        { error: "Queue item not found" },
        { status: 404 }
      );
    }

    // Update status to CLICKED if not already clicked/reviewed
    if (
      queueItem.status !== ReviewRequestStatus.CLICKED &&
      queueItem.status !== ReviewRequestStatus.REVIEWED
    ) {
      await prisma.reviewRequestQueueItem.update({
        where: { id: queueItemId },
        data: {
          status: ReviewRequestStatus.CLICKED,
          clickedAt: new Date(),
        },
      });
    }

    // Redirect to the actual review link
    return NextResponse.redirect(queueItem.campaign.reviewLinkUrl, 302);
  } catch (error) {
    console.error("Error in click tracking:", error);
    return NextResponse.json(
      {
        error: "Failed to process click tracking",
      },
      { status: 500 }
    );
  }
}

