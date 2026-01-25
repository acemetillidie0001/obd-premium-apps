import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import type { ActivityListResponse } from "@/lib/apps/social-auto-poster/types";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant } from "@/lib/auth/tenant";

/**
 * GET /api/social-auto-poster/activity
 * 
 * Returns activity log items (posts that have been posted or failed).
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

    // Collect all item IDs
    const itemIds = items.map((item) => item.id);

    // Fetch all delivery attempts in one query
    const allAttempts = itemIds.length > 0
      ? await prisma.socialDeliveryAttempt.findMany({
          where: {
            queueItemId: {
              in: itemIds,
            },
          },
          orderBy: {
            attemptedAt: "desc",
          },
        })
      : [];

    // Group attempts by queueItemId
    const attemptsByItemId = new Map<string, (typeof allAttempts)[number][]>();
    for (const attempt of allAttempts) {
      const queueItemId = attempt.queueItemId;
      if (!attemptsByItemId.has(queueItemId)) {
        attemptsByItemId.set(queueItemId, []);
      }
      attemptsByItemId.get(queueItemId)!.push(attempt);
    }

    // Map items with their attempts
    // Helper to convert database platform (snake_case) to type platform (camelCase)
    const mapPlatform = (platform: string): "facebook" | "instagram" | "x" | "googleBusiness" => {
      if (platform === "google_business") return "googleBusiness";
      return platform as "facebook" | "instagram" | "x";
    };

    const itemsWithAttempts = items.map((item) => {
      const attempts = attemptsByItemId.get(item.id) || [];

      return {
        id: item.id,
        queueItemId: item.id,
        platform: mapPlatform(item.platform),
        content: item.content,
        status: item.status as "posted" | "failed",
        postedAt: item.postedAt,
        errorMessage: item.errorMessage,
        attemptCount: item.attemptCount,
        attempts: attempts.map((attempt) => ({
          id: attempt.id,
          userId: attempt.userId,
          queueItemId: attempt.queueItemId,
          platform: mapPlatform(attempt.platform),
          success: attempt.success,
          errorMessage: attempt.errorMessage,
          responseData: attempt.responseData as Record<string, unknown> | undefined,
          attemptedAt: attempt.attemptedAt,
        })),
        metadata: item.metadata as Record<string, unknown> | undefined,
        // Include image fields if present (for exports)
        ...(item.imageUrl && {
          imageUrl: item.imageUrl,
          imageAltText: item.imageAltText,
          imageRequestId: item.imageRequestId,
        }),
        createdAt: item.createdAt,
      };
    });

    const response: ActivityListResponse = {
      items: itemsWithAttempts,
      total: itemsWithAttempts.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof BusinessContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching activity log:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch activity log" },
      { status: 500 }
    );
  }
}

