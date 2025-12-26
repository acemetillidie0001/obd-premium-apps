import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { listBusinessLocations } from "@/lib/apps/social-auto-poster/publishers/googleBusinessPublisher";

/**
 * GET /api/social-connections/google/status
 * 
 * Returns the Google Business Profile connection status for the current user.
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
      console.error("[Google Status] Error checking premium access:", error);
      return NextResponse.json(
        {
          ok: false,
          configured: false,
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
          configured: false,
          errorCode: "PREMIUM_REQUIRED",
          error: "Premium access required"
        },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    // Check if Google is configured (env vars)
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const configured = !!(googleClientId && googleClientSecret);

    if (!configured) {
      // Determine which env var is missing for clearer error message
      const missingVars: string[] = [];
      if (!googleClientId) missingVars.push("GOOGLE_CLIENT_ID");
      if (!googleClientSecret) missingVars.push("GOOGLE_CLIENT_SECRET");
      const configuredReason = missingVars.length > 0 
        ? `missing ${missingVars.join(" and ")}`
        : "Google OAuth not configured";

      return NextResponse.json({
        ok: false,
        configured: false,
        configuredReason,
        errorCode: "GOOGLE_NOT_CONFIGURED",
        connected: false,
      });
    }

    // Fetch connection from database
    let googleConnection = null;
    let googleDestination = null;
    let locations: Array<{ id: string; name: string }> = [];

    try {
      // Fetch Google connection
      googleConnection = await prisma.socialAccountConnection.findFirst({
        where: {
          userId,
          platform: "google_business",
        },
      });

      // Fetch destination selection
      googleDestination = await prisma.socialPostingDestination.findUnique({
        where: {
          userId_platform: {
            userId,
            platform: "google_business",
          },
        },
      });

      // If connected, fetch available locations
      if (googleConnection && googleConnection.accessToken) {
        const locationsResult = await listBusinessLocations({
          accessToken: googleConnection.accessToken,
          refreshToken: googleConnection.refreshToken,
          tokenExpiresAt: googleConnection.tokenExpiresAt,
        });

        if (locationsResult.ok && locationsResult.locations) {
          locations = locationsResult.locations.map((loc) => ({
            id: loc.id,
            name: loc.name,
          }));
        }
      }
    } catch (dbError) {
      // Database error - likely schema mismatch or table missing
      console.error("[Google Status] Database error:", dbError instanceof Error ? dbError.message : "Unknown database error");
      
      return NextResponse.json({
        ok: false,
        configured: true,
        errorCode: "DB_ERROR",
        errorMessage: "Database not ready for social connections.",
        connected: false,
      });
    }

    // Build successful response
    const response = {
      ok: true,
      configured,
      connected: !!googleConnection,
      location: googleDestination ? {
        id: googleDestination.selectedAccountId,
        name: googleDestination.selectedDisplayName,
      } : undefined,
      locations: locations.length > 0 ? locations : undefined,
      account: googleConnection ? {
        displayName: googleConnection.displayName,
        providerAccountId: googleConnection.providerAccountId,
      } : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    // Catch-all for unexpected errors
    console.error("[Google Status] Unexpected error:", error instanceof Error ? error.message : "Unknown error");
    
    // Check configured status even in error case
    const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    
    return NextResponse.json(
      {
        ok: false,
        configured,
        errorCode: "UNKNOWN_ERROR",
        errorMessage: "Unable to load connection status. Please refresh or try again.",
        connected: false,
      },
      { status: 200 }
    );
  }
}

