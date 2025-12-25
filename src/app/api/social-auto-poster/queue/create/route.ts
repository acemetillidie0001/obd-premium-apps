import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  CreateQueueItemRequest,
  CreateQueueItemResponse,
} from "@/lib/apps/social-auto-poster/types";
import {
  computeContentHash,
  computeContentFingerprint,
} from "@/lib/apps/social-auto-poster/utils";

/**
 * POST /api/social-auto-poster/queue/create
 * 
 * Creates a new queue item.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body: CreateQueueItemRequest = await request.json();

    // Validation
    if (!body.platform || !["facebook", "instagram", "x", "googleBusiness"].includes(body.platform)) {
      return NextResponse.json(
        { error: "Invalid platform. Must be 'facebook', 'instagram', 'x', or 'googleBusiness'" },
        { status: 400 }
      );
    }

    if (!body.content || typeof body.content !== "string" || body.content.trim().length === 0) {
      return NextResponse.json({ error: "content is required and must be non-empty" }, { status: 400 });
    }

    // Parse scheduledAt if provided
    let scheduledAt: Date | null = null;
    if (body.scheduledAt) {
      scheduledAt = new Date(body.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        return NextResponse.json({ error: "Invalid scheduledAt date format" }, { status: 400 });
      }
    }

    // Compute hash and fingerprint if not provided (for generated posts)
    const contentHash = body.contentHash || computeContentHash(body.content, body.platform, body.theme || undefined);
    const contentFingerprint = body.contentFingerprint || computeContentFingerprint(body.content, body.platform);

    const item = await prisma.socialQueueItem.create({
      data: {
        userId,
        platform: body.platform,
        content: body.content.trim(),
        status: "draft",
        scheduledAt,
        metadata: body.metadata as Prisma.InputJsonValue | undefined,
        reason: body.reason || null,
        contentTheme: body.theme || null,
        contentHash,
        contentFingerprint,
        isSimilar: body.isSimilar || false,
      },
    });

    const response: CreateQueueItemResponse = {
      item: {
        id: item.id,
        userId: item.userId,
        platform: item.platform as "facebook" | "instagram" | "x" | "googleBusiness",
        content: item.content,
        status: item.status as "draft" | "approved" | "scheduled" | "posted" | "failed",
        scheduledAt: item.scheduledAt,
        postedAt: item.postedAt,
        errorMessage: item.errorMessage,
        attemptCount: item.attemptCount,
        metadata: item.metadata as Record<string, unknown> | undefined,
        contentTheme: item.contentTheme as "education" | "promotion" | "social_proof" | "community" | "seasonal" | "general" | null,
        contentHash: item.contentHash,
        contentFingerprint: item.contentFingerprint,
        reason: item.reason,
        isSimilar: item.isSimilar,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error creating queue item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create queue item" },
      { status: 500 }
    );
  }
}

