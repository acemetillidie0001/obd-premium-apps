import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";

/**
 * GET /api/social-connections/meta/status
 * 
 * Returns the Meta (Facebook/Instagram) connection status for the current user.
 * Never returns tokens.
 */
export async function GET() {
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

    // Check if Meta is configured
    const configured = !!(process.env.META_APP_ID && process.env.META_APP_SECRET);

    // Fetch Facebook connection
    const facebookConnection = await prisma.socialAccountConnection.findFirst({
      where: {
        userId,
        platform: "facebook",
      },
    });

    // Fetch Instagram connection
    const instagramConnection = await prisma.socialAccountConnection.findFirst({
      where: {
        userId,
        platform: "instagram",
      },
    });

    // Fetch destination selections
    const facebookDestination = await prisma.socialPostingDestination.findUnique({
      where: {
        userId_platform: {
          userId,
          platform: "facebook",
        },
      },
    });

    const instagramDestination = await prisma.socialPostingDestination.findUnique({
      where: {
        userId_platform: {
          userId,
          platform: "instagram",
        },
      },
    });

    // Build response
    const response = {
      ok: true,
      configured,
      facebook: {
        connected: !!facebookConnection,
        pageName: facebookConnection?.displayName || facebookDestination?.selectedDisplayName || undefined,
        pageId: facebookConnection?.providerAccountId || undefined,
      },
      instagram: {
        connected: !!instagramConnection,
        available: !!instagramConnection || !!facebookConnection, // Available if either is connected
        username: instagramConnection?.displayName || instagramDestination?.selectedDisplayName || undefined,
        igBusinessId: instagramConnection?.providerAccountId || undefined,
        reasonIfUnavailable: !facebookConnection
          ? "Facebook must be connected first"
          : !instagramConnection
          ? "No IG business account linked to selected Page"
          : undefined,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching Meta connection status:", error);
    return NextResponse.json(
      { error: "Failed to fetch connection status" },
      { status: 500 }
    );
  }
}

