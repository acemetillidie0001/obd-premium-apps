import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import type { QueueListResponse, QueueStatus } from "@/lib/apps/social-auto-poster/types";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";

/**
 * GET /api/social-auto-poster/queue
 * 
 * Returns queue items for the authenticated user.
 * Query params:
 * - status: filter by status (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireTenant();
    await requirePermission("SOCIAL_AUTO_POSTER", "VIEW");

    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Premium access required" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get("status");

    // Build where clause
    const where: {
      userId: string;
      status?: QueueStatus;
    } = {
      userId,
    };

    if (statusFilter && ["draft", "approved", "scheduled", "posted", "failed"].includes(statusFilter)) {
      where.status = statusFilter as QueueStatus;
    }

    const items = await prisma.socialQueueItem.findMany({
      where,
      orderBy: [
        { scheduledAt: "asc" },
        { createdAt: "desc" },
      ],
    });

    const response: QueueListResponse = {
      items: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        platform: item.platform as "facebook" | "instagram" | "x" | "googleBusiness",
        content: item.content,
        status: item.status as QueueStatus,
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
      })),
      total: items.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof BusinessContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching queue items:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch queue items" },
      { status: 500 }
    );
  }
}

