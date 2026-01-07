import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { Prisma } from "@prisma/client";
import type {
  CreateQueueItemRequest,
  CreateQueueItemResponse,
  PostImage,
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
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

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

    // Extract image metadata from image field if present (new structure)
    // Also support legacy metadata structure for backward compatibility
    let imageStatus: "skipped" | "generated" | "fallback" | null = null;
    let imageUrl: string | null = null;
    let imageAltText: string | null = null;
    let imageProvider: string | null = null;
    let imageAspect: string | null = null;
    let imageCategory: string | null = null;
    let imageErrorCode: string | null = null;
    let imageFallbackReason: string | null = null;
    let imageRequestId: string | null = null;

    // Check for new image field structure first
    const image = (body as { image?: PostImage }).image;
    if (image) {
      imageStatus = image.status;
      imageUrl = image.url || null;
      imageAltText = image.altText || null;
      imageProvider = image.provider || null;
      imageAspect = image.aspect || null;
      imageCategory = image.category || null;
      imageErrorCode = image.errorCode || null;
      imageFallbackReason = image.fallbackReason || null;
      imageRequestId = image.requestId || null;
    } else {
      // Fallback to legacy metadata structure for backward compatibility
      const metadata = body.metadata as Record<string, unknown> | undefined;
      if (metadata) {
        imageStatus = (metadata.imageStatus as "skipped" | "generated" | "fallback" | undefined) || null;
        imageUrl = (metadata.imageUrl as string | undefined) || null;
        imageAltText = (metadata.imageAltText as string | undefined) || null;
        imageProvider = (metadata.imageProvider as string | undefined) || null;
        imageAspect = (metadata.imageAspect as string | undefined) || null;
        imageCategory = (metadata.imageCategory as string | undefined) || null;
        imageErrorCode = (metadata.imageErrorCode as string | undefined) || null;
        imageFallbackReason = (metadata.imageFallbackReason as string | undefined) || null;
        imageRequestId = (metadata.imageRequestId as string | undefined) || null;
      }
    }

    // If no image data at all, default to skipped
    if (!imageStatus) {
      imageStatus = "skipped";
    }

    // Clean metadata (remove image fields since they're stored separately)
    const metadata = body.metadata as Record<string, unknown> | undefined;
    const cleanedMetadata: Record<string, unknown> = metadata ? { ...metadata } : {};
    delete cleanedMetadata.imageStatus;
    delete cleanedMetadata.imageUrl;
    delete cleanedMetadata.imageAltText;
    delete cleanedMetadata.imageProvider;
    delete cleanedMetadata.imageAspect;
    delete cleanedMetadata.imageCategory;
    delete cleanedMetadata.imageErrorCode;
    delete cleanedMetadata.imageFallbackReason;
    delete cleanedMetadata.imageRequestId;

    const item = await prisma.socialQueueItem.create({
      data: {
        userId,
        platform: body.platform,
        content: body.content.trim(),
        status: "draft",
        scheduledAt,
        metadata: Object.keys(cleanedMetadata).length > 0 ? (cleanedMetadata as Prisma.InputJsonValue) : undefined,
        reason: body.reason || null,
        contentTheme: body.theme || null,
        contentHash,
        contentFingerprint,
        isSimilar: body.isSimilar || false,
        imageStatus,
        imageUrl,
        imageAltText,
        imageProvider,
        imageAspect,
        imageCategory,
        imageErrorCode,
        imageFallbackReason,
        imageRequestId,
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
        imageStatus: item.imageStatus as "skipped" | "generated" | "fallback" | null,
        imageUrl: item.imageUrl,
        imageAltText: item.imageAltText,
        imageProvider: item.imageProvider,
        imageAspect: item.imageAspect,
        imageCategory: item.imageCategory,
        imageErrorCode: item.imageErrorCode,
        imageFallbackReason: item.imageFallbackReason,
        imageRequestId: item.imageRequestId,
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

