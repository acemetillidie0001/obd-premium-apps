import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";

/**
 * POST /api/social-connections/google/disconnect
 * 
 * Disconnects Google Business Profile connection for the current user.
 * Deletes connection and destination records.
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

    // Delete Google Business Profile connection
    await prisma.socialAccountConnection.deleteMany({
      where: {
        userId,
        platform: "google_business",
      },
    });

    // Delete Google Business Profile destination
    await prisma.socialPostingDestination.deleteMany({
      where: {
        userId,
        platform: "google_business",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error disconnecting Google:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}

