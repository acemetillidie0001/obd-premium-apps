import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import type { SimulateRunRequest, SimulateRunResponse } from "@/lib/apps/social-auto-poster/types";

/**
 * POST /api/social-auto-poster/queue/simulate-run
 * 
 * Mock Provider: Simulates posting by marking items as posted or failed.
 * This is for V3A (Mock Provider) - real OAuth posting will come in V3B.
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

    // Simulate posting: 80% success rate, 20% failure
    for (const item of itemsToProcess) {
      const success = Math.random() > 0.2; // 80% success rate

      if (success) {
        // Mark as posted
        await prisma.socialQueueItem.update({
          where: { id: item.id },
          data: {
            status: "posted",
            postedAt: new Date(),
            attemptCount: item.attemptCount + 1,
          },
        });

        // Create a successful delivery attempt
        await prisma.socialDeliveryAttempt.create({
          data: {
            userId,
            queueItemId: item.id,
            platform: item.platform,
            success: true,
            responseData: {
              mock: true,
              message: "Post simulated successfully",
              timestamp: new Date().toISOString(),
            },
          },
        });

        succeeded++;
        results.push({
          queueItemId: item.id,
          success: true,
        });
      } else {
        // Mark as failed
        const errorMessage = "Simulated posting failure (Mock Provider)";
        await prisma.socialQueueItem.update({
          where: { id: item.id },
          data: {
            status: "failed",
            errorMessage,
            attemptCount: item.attemptCount + 1,
          },
        });

        // Create a failed delivery attempt
        await prisma.socialDeliveryAttempt.create({
          data: {
            userId,
            queueItemId: item.id,
            platform: item.platform,
            success: false,
            errorMessage,
            responseData: {
              mock: true,
              error: errorMessage,
              timestamp: new Date().toISOString(),
            },
          },
        });

        failed++;
        results.push({
          queueItemId: item.id,
          success: false,
          errorMessage,
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

