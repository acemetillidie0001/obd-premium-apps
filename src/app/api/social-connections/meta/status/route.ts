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

    // Check if Meta is configured (env vars) - check early for consistent responses
    const metaAppId = process.env.META_APP_ID;
    const metaAppSecret = process.env.META_APP_SECRET;
    const configured = !!(metaAppId && metaAppSecret);

    // Check premium access
    let hasAccess: boolean;
    try {
      hasAccess = await hasPremiumAccess();
    } catch (error) {
      console.error("[Meta Status] Error checking premium access:", error);
      return NextResponse.json(
        {
          ok: false,
          configured,
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
          configured,
          errorCode: "PREMIUM_REQUIRED",
          error: "Premium access required"
        },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    if (!configured) {
      // Determine which env var is missing for clearer error message
      const missingVars: string[] = [];
      if (!metaAppId) missingVars.push("META_APP_ID");
      if (!metaAppSecret) missingVars.push("META_APP_SECRET");
      const configuredReason = missingVars.length > 0 
        ? `missing ${missingVars.join(" and ")}`
        : "Meta app not configured";

      return NextResponse.json({
        ok: false,
        configured: false,
        configuredReason,
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

    // Extract permission info from metaJson
    const facebookMeta = facebookConnection?.metaJson as Record<string, unknown> | null;
    const pagesAccessGranted = facebookMeta?.pagesAccessGranted === true;
    const basicConnectGranted = facebookMeta?.basicConnectGranted === true;

    // Build successful response
    const response = {
      ok: true,
      configured,
      facebook: {
        connected: !!facebookConnection,
        basicConnectGranted: basicConnectGranted || false,
        pagesAccessGranted: pagesAccessGranted || false,
        pageName: facebookConnection?.displayName || facebookDestination?.selectedDisplayName || undefined,
        pageId: facebookConnection?.providerAccountId || undefined,
      },
      instagram: {
        connected: !!instagramConnection,
        available: false, // Instagram not available until publishing permissions are granted
        username: instagramConnection?.displayName || instagramDestination?.selectedDisplayName || undefined,
        igBusinessId: instagramConnection?.providerAccountId || undefined,
        reasonIfUnavailable: !pagesAccessGranted
          ? "Pages access must be enabled first"
          : "Publishing permissions require additional Meta setup (Advanced Access / App Review)",
      },
      publishing: {
        enabled: false, // Publishing not enabled yet (requires pages_manage_posts + instagram_content_publish)
        reasonIfDisabled: "Publishing requires additional Meta setup: Advanced Access and App Review for pages_manage_posts and instagram_content_publish permissions.",
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    // Catch-all for unexpected errors
    console.error("[Meta Status] Unexpected error:", error instanceof Error ? error.message : "Unknown error");
    
    // Check configured status even in error case
    const configured = !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
    
    return NextResponse.json(
      {
        ok: false,
        configured,
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

