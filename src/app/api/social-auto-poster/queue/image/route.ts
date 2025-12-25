/**
 * OBD Social Auto-Poster - Queue Image Info API
 * 
 * GET /api/social-auto-poster/queue/image?queueItemId=...
 * 
 * Returns canonical image information for a queue item.
 * If imageRequestId exists, fetches from ImageRequest (source of truth).
 * Otherwise, returns legacy fields from SocialQueueItem.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { getImageRequestTimeline } from "@/lib/image-engine/events/timeline";

export interface QueueImageResponse {
  ok: boolean;
  queueItemId: string;
  source: "engine" | "legacy";
  image?: {
    requestId?: string;
    status: string;
    url?: string;
    altText?: string;
    provider?: string;
    storage?: string;
    updatedAt?: string;
  };
  events?: Array<{
    type: string;
    ok: boolean;
    messageSafe?: string;
    createdAt: string;
  }>;
  error?: string;
}

/**
 * GET /api/social-auto-poster/queue/image
 * 
 * Query params:
 * - queueItemId: required, the queue item ID
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<QueueImageResponse>(
        {
          ok: false,
          queueItemId: "",
          source: "legacy",
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // Premium access check
    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.json<QueueImageResponse>(
        {
          ok: false,
          queueItemId: "",
          source: "legacy",
          error: "Premium access required",
        },
        { status: 403 }
      );
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const queueItemId = searchParams.get("queueItemId");

    if (!queueItemId) {
      return NextResponse.json<QueueImageResponse>(
        {
          ok: false,
          queueItemId: "",
          source: "legacy",
          error: "queueItemId is required",
        },
        { status: 400 }
      );
    }

    // Load queue item and verify ownership
    const queueItem = await prisma.socialQueueItem.findUnique({
      where: { id: queueItemId },
      select: {
        id: true,
        userId: true,
        imageRequestId: true,
        imageUrl: true,
        imageAltText: true,
        imageStatus: true,
      },
    });

    if (!queueItem) {
      return NextResponse.json<QueueImageResponse>(
        {
          ok: false,
          queueItemId,
          source: "legacy",
          error: "Queue item not found",
        },
        { status: 404 }
      );
    }

    // Verify ownership
    if (queueItem.userId !== userId) {
      return NextResponse.json<QueueImageResponse>(
        {
          ok: false,
          queueItemId,
          source: "legacy",
          error: "Unauthorized",
        },
        { status: 403 }
      );
    }

    // If imageRequestId exists, fetch from ImageRequest (source of truth)
    if (queueItem.imageRequestId) {
      try {
        const timeline = await getImageRequestTimeline(queueItem.imageRequestId);

        if (!timeline) {
          // ImageRequest not found, fall back to legacy
          return NextResponse.json<QueueImageResponse>({
            ok: true,
            queueItemId,
            source: "legacy",
            image: {
              status: queueItem.imageStatus || "unknown",
              url: queueItem.imageUrl || undefined,
              altText: queueItem.imageAltText || undefined,
            },
          });
        }

        // Get last 10 events (ordered desc, then take last 10)
        const allEvents = timeline.events;
        const last10Events = allEvents.slice(-10).reverse(); // Most recent first

        // Map ImageRequest status to display status
        const statusMap: Record<string, string> = {
          queued: "queued",
          generated: "generated",
          fallback: "fallback",
          failed: "failed",
          skipped: "skipped",
        };

        const displayStatus = statusMap[timeline.request.status] || timeline.request.status;

        // Get full ImageRequest to extract provider, storage, and altText
        const imageRequest = await prisma.imageRequest.findUnique({
          where: { requestId: queueItem.imageRequestId },
          select: {
            provider: true,
            storage: true,
            altText: true,
            updatedAt: true,
          },
        });

        return NextResponse.json<QueueImageResponse>({
          ok: true,
          queueItemId,
          source: "engine",
          image: {
            requestId: queueItem.imageRequestId,
            status: displayStatus,
            url: timeline.request.imageUrl || undefined,
            altText: imageRequest?.altText || undefined,
            provider: imageRequest?.provider || undefined,
            storage: imageRequest?.storage || undefined,
            updatedAt: timeline.request.updatedAt.toISOString(),
          },
          events: last10Events.map((event) => ({
            type: event.type,
            ok: event.ok,
            messageSafe: event.messageSafe || undefined,
            createdAt: event.createdAt.toISOString(),
          })),
        });
      } catch (timelineError) {
        // If timeline fetch fails, fall back to legacy
        console.warn(
          `[Queue Image API] Failed to fetch timeline for ${queueItem.imageRequestId}:`,
          timelineError
        );

        return NextResponse.json<QueueImageResponse>({
          ok: true,
          queueItemId,
          source: "legacy",
          image: {
            status: queueItem.imageStatus || "unknown",
            url: queueItem.imageUrl || undefined,
            altText: queueItem.imageAltText || undefined,
          },
        });
      }
    }

    // No imageRequestId, return legacy fields
    return NextResponse.json<QueueImageResponse>({
      ok: true,
      queueItemId,
      source: "legacy",
      image: {
        status: queueItem.imageStatus || "unknown",
        url: queueItem.imageUrl || undefined,
        altText: queueItem.imageAltText || undefined,
      },
    });
  } catch (error) {
    console.error("[Queue Image API] Error:", error);
    return NextResponse.json<QueueImageResponse>(
      {
        ok: false,
        queueItemId: "",
        source: "legacy",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

