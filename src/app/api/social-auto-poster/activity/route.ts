import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActivityListResponse } from "@/lib/apps/social-auto-poster/types";

/**
 * GET /api/social-auto-poster/activity
 * 
 * Returns activity log items (posts that have been posted or failed).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get items that have been posted or failed
    const items = await prisma.socialQueueItem.findMany({
      where: {
        userId,
        status: {
          in: ["posted", "failed"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limit to most recent 100
    });

    // Get delivery attempts for each item
    const itemsWithAttempts = await Promise.all(
      items.map(async (item) => {
        const attempts = await prisma.socialDeliveryAttempt.findMany({
          where: {
            queueItemId: item.id,
          },
          orderBy: {
            attemptedAt: "desc",
          },
        });

        return {
          id: item.id,
          queueItemId: item.id,
          platform: item.platform as "facebook" | "instagram" | "x" | "googleBusiness",
          content: item.content,
          status: item.status as "posted" | "failed",
          postedAt: item.postedAt,
          errorMessage: item.errorMessage,
          attemptCount: item.attemptCount,
          attempts: attempts.map((attempt) => ({
            id: attempt.id,
            userId: attempt.userId,
            queueItemId: attempt.queueItemId,
            platform: attempt.platform as "facebook" | "instagram" | "x" | "googleBusiness",
            success: attempt.success,
            errorMessage: attempt.errorMessage,
            responseData: attempt.responseData as Record<string, unknown> | undefined,
            attemptedAt: attempt.attemptedAt,
          })),
          createdAt: item.createdAt,
        };
      })
    );

    const response: ActivityListResponse = {
      items: itemsWithAttempts,
      total: itemsWithAttempts.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching activity log:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch activity log" },
      { status: 500 }
    );
  }
}

