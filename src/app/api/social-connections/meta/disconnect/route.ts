import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";

/**
 * POST /api/social-connections/meta/disconnect
 * 
 * Disconnects Meta (Facebook/Instagram) connections for the current user.
 * Deletes both connection records and destination selections.
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    let userId: string;
    let businessId: string;
    try {
      const ctx = await requirePermission("SOCIAL_AUTO_POSTER", "APPLY");
      userId = ctx.userId;
      businessId = ctx.businessId;
    } catch (err) {
      if (err instanceof BusinessContextError) {
        const code = err.status === 401 ? "AUTH_REQUIRED" : "BUSINESS_CONTEXT_REQUIRED";
        return NextResponse.json(
          { ok: false, code, message: err.message },
          { status: err.status }
        );
      }
      return NextResponse.json(
        { ok: false, code: "BUSINESS_CONTEXT_REQUIRED", message: "Business context required" },
        { status: 403 }
      );
    }

    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Premium access required" },
        { status: 403 }
      );
    }

    // Log disconnect event before deletion
    try {
      // Log disconnect for Facebook if connected
      const fbConnection = await prisma.socialAccountConnection.findFirst({
        where: {
          userId,
          platform: "facebook",
          metaJson: {
            path: ["businessId"],
            equals: businessId,
          },
        },
      });
      if (fbConnection) {
        await prisma.socialPublishAttempt.create({
          data: {
            userId,
            platform: "facebook",
            kind: "disconnect",
            status: "success",
          },
        });
      }

      // Log disconnect for Instagram if connected
      const igConnection = await prisma.socialAccountConnection.findFirst({
        where: {
          userId,
          platform: "instagram",
          metaJson: {
            path: ["businessId"],
            equals: businessId,
          },
        },
      });
      if (igConnection) {
        await prisma.socialPublishAttempt.create({
          data: {
            userId,
            platform: "instagram",
            kind: "disconnect",
            status: "success",
          },
        });
      }
    } catch (logError) {
      // Don't fail disconnect if logging fails
      console.error("[Meta Disconnect] Failed to log disconnect event:", logError);
    }

    // Delete all Meta connections (Facebook and Instagram)
    await prisma.socialAccountConnection.deleteMany({
      where: {
        userId,
        platform: {
          in: ["facebook", "instagram"],
        },
        metaJson: {
          path: ["businessId"],
          equals: businessId,
        },
      },
    });

    // Note: SocialPostingDestination is user-scoped in schema (no businessId),
    // so we intentionally do NOT delete it here to avoid cross-tenant leakage
    // in multi-membership scenarios. Destinations are treated as invalid unless
    // a business-scoped connection exists.

    // Log disconnect action (no tokens/secrets)
    console.log(`[Meta Disconnect] userId=${userId}, platforms=[facebook,instagram], action=disconnect, status=success`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error disconnecting Meta accounts:", error);
    return NextResponse.json(
      { error: "Failed to disconnect accounts" },
      { status: 500 }
    );
  }
}

