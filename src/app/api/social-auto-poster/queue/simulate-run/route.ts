import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import type { SimulateRunRequest, SimulateRunResponse } from "@/lib/apps/social-auto-poster/types";
import { processScheduledPost } from "@/lib/apps/social-auto-poster/processScheduledPost";

/**
 * POST /api/social-auto-poster/queue/simulate-run
 * 
 * Processes scheduled posts:
 * - Uses real Meta publishing if Facebook/Instagram connections exist
 * - Falls back to simulation if no connections
 * 
 * Can be called manually or by the automated runner.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Premium access required" },
        { status: 403 }
      );
    }

    const userId = session.user.id;
    const body: SimulateRunRequest = await request.json();

    // Find items to process
    const where: {
      userId: string;
      status: "scheduled";
      scheduledAt?: { lte: Date };
      id?: { in: string[] };
    } = {
      userId,
      status: "scheduled",
    };

    if (body.queueItemIds && body.queueItemIds.length > 0) {
      where.id = { in: body.queueItemIds };
    } else {
      // Process all scheduled items that are due
      where.scheduledAt = { lte: new Date() };
    }

    const itemsToProcess = await prisma.socialQueueItem.findMany({
      where,
    });

    if (itemsToProcess.length === 0) {
      return NextResponse.json({
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      } as SimulateRunResponse);
    }

    const results: Array<{
      queueItemId: string;
      success: boolean;
      errorMessage?: string;
    }> = [];

    let succeeded = 0;
    let failed = 0;

    // Process each item (uses real publishing if Meta connected, otherwise simulates)
    for (const item of itemsToProcess) {
      const result = await processScheduledPost(item.id, userId);
      
      if (result.success) {
        succeeded++;
        results.push({
          queueItemId: item.id,
          success: true,
        });
      } else {
        failed++;
        results.push({
          queueItemId: item.id,
          success: false,
          errorMessage: result.errorMessage,
        });
      }
    }

    const response: SimulateRunResponse = {
      processed: itemsToProcess.length,
      succeeded,
      failed,
      results,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error simulating post run:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to simulate post run" },
      { status: 500 }
    );
  }
}

