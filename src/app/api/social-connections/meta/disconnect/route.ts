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
export async function POST() {
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error disconnecting Meta accounts:", error);
    return NextResponse.json(
      { error: "Failed to disconnect accounts" },
      { status: 500 }
    );
  }
}

