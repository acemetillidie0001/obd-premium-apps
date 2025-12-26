import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";

/**
 * GET /api/social-connections/meta/status
 * 
 * Returns the Meta (Facebook/Instagram) connection status for the current user.
 * Never returns tokens.
 * Never returns 500 - always returns structured error responses.
 */
export async function GET() {
  try {
    // Validate auth
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          ok: false,
          errorCode: "UNAUTHORIZED",
          error: "Unauthorized"
        },
        { status: 401 }
      );
    }

    // Check premium access
    let hasAccess: boolean;
    try {
      hasAccess = await hasPremiumAccess();
    } catch (error) {
      console.error("[Meta Status] Error checking premium access:", error);
      return NextResponse.json(
        {
          ok: false,
          errorCode: "PREMIUM_CHECK_FAILED",
          error: "Unable to verify premium access"
        },
        { status: 200 }
      );
    }

    if (!hasAccess) {
      return NextResponse.json(
        { 
          ok: false,
          errorCode: "PREMIUM_REQUIRED",
          error: "Premium access required"
        },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    // Check if Meta is configured (env vars)
    const metaAppId = process.env.META_APP_ID;
    const metaAppSecret = process.env.META_APP_SECRET;
    const configured = !!(metaAppId && metaAppSecret);

    if (!configured) {
      return NextResponse.json({
        ok: false,
        configured: false,
        errorCode: "META_NOT_CONFIGURED",
        facebook: {
          connected: false,
        },
        instagram: {
          connected: false,
          available: false,
        },
      });
    }

    // Fetch connections from database
    let facebookConnection = null;
    let instagramConnection = null;
    let facebookDestination = null;
    let instagramDestination = null;

    try {
      // Fetch Facebook connection
      facebookConnection = await prisma.socialAccountConnection.findFirst({
        where: {
          userId,
          platform: "facebook",
        },
      });

      // Fetch Instagram connection
      instagramConnection = await prisma.socialAccountConnection.findFirst({
        where: {
          userId,
          platform: "instagram",
        },
      });

      // Fetch destination selections
      facebookDestination = await prisma.socialPostingDestination.findUnique({
        where: {
          userId_platform: {
            userId,
            platform: "facebook",
          },
        },
      });

      instagramDestination = await prisma.socialPostingDestination.findUnique({
        where: {
          userId_platform: {
            userId,
            platform: "instagram",
          },
        },
      });
    } catch (dbError) {
      // Database error - likely schema mismatch or table missing
      console.error("[Meta Status] Database error:", dbError instanceof Error ? dbError.message : "Unknown database error");
      
      return NextResponse.json({
        ok: false,
        configured: true,
        errorCode: "DB_ERROR",
        errorMessage: "Database not ready for social connections.",
        facebook: {
          connected: false,
        },
        instagram: {
          connected: false,
          available: false,
        },
      });
    }

    // Build successful response
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
    // Catch-all for unexpected errors
    console.error("[Meta Status] Unexpected error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      {
        ok: false,
        errorCode: "UNKNOWN_ERROR",
        errorMessage: "Unable to load connection status. Please refresh or try again.",
        facebook: {
          connected: false,
        },
        instagram: {
          connected: false,
          available: false,
        },
      },
      { status: 200 }
    );
  }
}

