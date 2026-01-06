import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import type { UpdateQueueItemRequest, QueueStatus } from "@/lib/apps/social-auto-poster/types";

/**
 * POST /api/social-auto-poster/queue/approve
 * 
 * Updates a queue item's status.
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
    const body: UpdateQueueItemRequest = await request.json();

    // Validation
    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Check that the item exists and belongs to the user
    const existingItem = await prisma.socialQueueItem.findFirst({
      where: {
        id: body.id,
        userId,
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
    }

    // Build update data
    const updateData: {
      status?: QueueStatus;
      scheduledAt?: Date | null;
      content?: string;
    } = {};

    if (body.status) {
      const validStatuses: QueueStatus[] = ["draft", "approved", "scheduled", "posted", "failed"];
      if (!validStatuses.includes(body.status as QueueStatus)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.status = body.status as QueueStatus;
    }

    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt === null) {
        updateData.scheduledAt = null;
      } else {
        const scheduledDate = new Date(body.scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
          return NextResponse.json({ error: "Invalid scheduledAt date format" }, { status: 400 });
        }
        updateData.scheduledAt = scheduledDate;
      }
    }

    if (body.content !== undefined) {
      if (typeof body.content !== "string" || body.content.trim().length === 0) {
        return NextResponse.json({ error: "content must be a non-empty string" }, { status: 400 });
      }
      updateData.content = body.content.trim();
    }

    // Update the item (defense-in-depth: include userId in where clause)
    const updateResult = await prisma.socialQueueItem.updateMany({
      where: {
        id: body.id,
        userId, // Defense-in-depth: ensure we only update user's own items
      },
      data: updateData,
    });

    // If no rows were affected, return 404 (shouldn't happen after findFirst check, but defense-in-depth)
    if (updateResult.count === 0) {
      return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
    }

    // Fetch the updated item to return in response
    const updatedItem = await prisma.socialQueueItem.findUnique({
      where: { id: body.id },
    });

    if (!updatedItem) {
      return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
    }

    return NextResponse.json({
      item: {
        id: updatedItem.id,
        userId: updatedItem.userId,
        platform: updatedItem.platform as "facebook" | "instagram" | "x" | "googleBusiness",
        content: updatedItem.content,
        status: updatedItem.status as "draft" | "approved" | "scheduled" | "posted" | "failed",
        scheduledAt: updatedItem.scheduledAt,
        postedAt: updatedItem.postedAt,
        errorMessage: updatedItem.errorMessage,
        attemptCount: updatedItem.attemptCount,
        metadata: updatedItem.metadata as Record<string, unknown> | undefined,
        createdAt: updatedItem.createdAt,
        updatedAt: updatedItem.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating queue item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update queue item" },
      { status: 500 }
    );
  }
}

