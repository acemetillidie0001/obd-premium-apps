/**
 * OBD Social Auto-Poster - Regenerate Image API
 * 
 * POST /api/social-auto-poster/queue/image/regenerate
 * 
 * Regenerates an image for a queue item by calling the image engine regenerate endpoint.
 * Updates queue item cache with new image data.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";

export interface RegenerateImageResponse {
  ok: boolean;
  queueItemId: string;
  requestId?: string;
  engineStatus?: string;
  imageUrl?: string;
  errorCode?: string;
}

/**
 * POST /api/social-auto-poster/queue/image/regenerate
 * 
 * Body: { queueItemId: string }
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    let userId: string;
    try {
      ({ userId } = await requireTenant());
      await requirePermission("SOCIAL_AUTO_POSTER", "EDIT_DRAFT");
    } catch (err) {
      const code =
        err instanceof BusinessContextError
          ? err.status === 401
            ? "UNAUTHORIZED"
            : err.status === 403
              ? "FORBIDDEN"
              : "DB_UNAVAILABLE"
          : "UNAUTHORIZED";
      return NextResponse.json<RegenerateImageResponse>(
        { ok: false, queueItemId: "", errorCode: code },
        { status: 200 }
      );
    }

    // Premium access check - always return 200 with ok=false
    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.json<RegenerateImageResponse>(
        {
          ok: false,
          queueItemId: "",
          errorCode: "PREMIUM_REQUIRED",
        },
        { status: 200 }
      );
    }

    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json<RegenerateImageResponse>(
        {
          ok: false,
          queueItemId: "",
          errorCode: "INVALID_BODY",
        },
        { status: 200 }
      );
    }

    const req = body as { queueItemId?: string };
    if (!req.queueItemId || typeof req.queueItemId !== "string") {
      return NextResponse.json<RegenerateImageResponse>(
        {
          ok: false,
          queueItemId: "",
          errorCode: "MISSING_QUEUE_ITEM_ID",
        },
        { status: 200 }
      );
    }

    const queueItemId = req.queueItemId.trim();

    // Load queue item and verify ownership
    const queueItem = await prisma.socialQueueItem.findUnique({
      where: { id: queueItemId },
      select: {
        id: true,
        userId: true,
        imageRequestId: true,
        imageUrl: true,
        imageStatus: true,
      },
    });

    if (!queueItem) {
      return NextResponse.json<RegenerateImageResponse>(
        {
          ok: false,
          queueItemId,
          errorCode: "NOT_FOUND",
        },
        { status: 200 }
      );
    }

    // Verify ownership - always return 200 with ok=false
    if (queueItem.userId !== userId) {
      return NextResponse.json<RegenerateImageResponse>(
        {
          ok: false,
          queueItemId,
          errorCode: "UNAUTHORIZED",
        },
        { status: 200 }
      );
    }

    // Check if imageRequestId exists
    if (!queueItem.imageRequestId) {
      return NextResponse.json<RegenerateImageResponse>(
        {
          ok: false,
          queueItemId,
          errorCode: "NO_IMAGE_REQUEST",
        },
        { status: 200 }
      );
    }

    // Call image engine regenerate endpoint (server-side fetch)
    // Construct base URL from request headers or use localhost fallback
    const host = request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const baseUrl = host ? `${protocol}://${host}` : "http://localhost:3000";
    
    let engineResponse: Response;
    try {
      engineResponse = await fetch(`${baseUrl}/api/image-engine/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId: queueItem.imageRequestId }),
      });
    } catch (fetchError) {
      return NextResponse.json<RegenerateImageResponse>(
        {
          ok: false,
          queueItemId,
          requestId: queueItem.imageRequestId,
          errorCode: "ENGINE_FETCH_FAILED",
        },
        { status: 200 }
      );
    }

    if (!engineResponse.ok) {
      return NextResponse.json<RegenerateImageResponse>(
        {
          ok: false,
          queueItemId,
          requestId: queueItem.imageRequestId,
          errorCode: "ENGINE_ERROR",
        },
        { status: 200 }
      );
    }

    const engineResult = await engineResponse.json();

    // Fetch ImageRequest directly via Prisma (preferred for speed)
    let imageRequest;
    try {
      imageRequest = await prisma.imageRequest.findUnique({
        where: { requestId: queueItem.imageRequestId },
        select: {
          requestId: true,
          status: true,
          imageUrl: true,
          altText: true,
          provider: true,
          platform: true,
          category: true,
          aspect: true,
        },
      });
    } catch (prismaError) {
      // Non-blocking: log but continue
      console.warn(
        `[Regenerate Image API] Failed to fetch ImageRequest ${queueItem.imageRequestId}:`,
        prismaError
      );
    }

    // Update queue item based on ImageRequest status (source of truth)
    try {
      if (imageRequest?.status === "generated" && imageRequest.imageUrl) {
        // New generated image - update queue item with all fields
        await prisma.socialQueueItem.update({
          where: { id: queueItemId },
          data: {
            imageUrl: imageRequest.imageUrl,
            imageAltText: imageRequest.altText || null,
            imageStatus: "generated",
            imageProvider: imageRequest.provider ? String(imageRequest.provider) : null,
            imageAspect: imageRequest.aspect || null,
            imageCategory: imageRequest.category || null,
            // imageRequestId remains consistent (already set)
          },
        });
      } else if (imageRequest) {
        // Status is failed/fallback/skipped - update status but preserve existing good image
        const statusMap: Record<string, "fallback" | "failed" | "skipped"> = {
          fallback: "fallback",
          failed: "failed",
          skipped: "skipped",
        };
        const newStatus = statusMap[imageRequest.status] || "failed";

        // Only update if queue item doesn't already have a good imageUrl
        // This prevents overwriting a good image with a bad status
        if (!queueItem.imageUrl || queueItem.imageStatus === "failed" || queueItem.imageStatus === "fallback") {
          await prisma.socialQueueItem.update({
            where: { id: queueItemId },
            data: {
              imageStatus: newStatus,
              // Don't clear imageUrl if it exists (preserve good images)
            },
          });
        } else {
          // Queue item has a good image - just update status, don't clear URL
          await prisma.socialQueueItem.update({
            where: { id: queueItemId },
            data: {
              imageStatus: newStatus,
            },
          });
        }
      }
    } catch (updateError) {
      // Non-blocking: log but don't fail the request
      console.warn(
        `[Regenerate Image API] Failed to update queue item ${queueItemId}:`,
        updateError
      );
    }

    // Build response payload
    const response: RegenerateImageResponse = {
      ok: engineResult.ok || false,
      queueItemId,
      requestId: queueItem.imageRequestId,
    };

    if (imageRequest) {
      response.engineStatus = imageRequest.status;
      if (imageRequest.imageUrl) {
        response.imageUrl = imageRequest.imageUrl;
      }
    }

    if (engineResult.errorCode) {
      response.errorCode = engineResult.errorCode;
    }

    return NextResponse.json<RegenerateImageResponse>(response);
  } catch (error) {
    console.error("[Regenerate Image API] Error:", error);
    return NextResponse.json<RegenerateImageResponse>(
      {
        ok: false,
        queueItemId: "",
        errorCode: "INTERNAL_ERROR",
      },
      { status: 200 }
    );
  }
}

