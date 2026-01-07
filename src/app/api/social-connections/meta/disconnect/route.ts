import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";

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

    // Log disconnect event before deletion
    try {
      // Log disconnect for Facebook if connected
      const fbConnection = await prisma.socialAccountConnection.findFirst({
        where: {
          userId,
          platform: "facebook",
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
      },
    });

    // Delete destination selections
    await prisma.socialPostingDestination.deleteMany({
      where: {
        userId,
        platform: {
          in: ["facebook", "instagram"],
        },
      },
    });

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

