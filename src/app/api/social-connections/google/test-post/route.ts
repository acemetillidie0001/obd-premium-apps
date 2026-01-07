import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { publishToGoogleBusiness } from "@/lib/apps/social-auto-poster/publishers/googleBusinessPublisher";
import { requireString } from "@/lib/utils/requireString";

/**
 * POST /api/social-connections/google/test-post
 * 
 * Publishes a test post to the selected Google Business Profile location.
 * Logs attempts to SocialPublishAttempt table.
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

    // Get selected destination
    const googleDestination = await prisma.socialPostingDestination.findUnique({
      where: {
        userId_platform: {
          userId,
          platform: "google_business",
        },
      },
    });

    if (!googleDestination) {
      return NextResponse.json(
        { error: "No Google Business Profile location selected" },
        { status: 404 }
      );
    }

    // Get connection
    const googleConnection = await prisma.socialAccountConnection.findFirst({
      where: {
        userId,
        platform: "google_business",
      },
    });

    if (!googleConnection) {
      return NextResponse.json(
        { error: "Google Business Profile connection not found" },
        { status: 404 }
      );
    }

    // Validate and narrow required fields (fail-fast with clear errors)
    let locationId: string;
    let accessToken: string;
    try {
      locationId = requireString(googleDestination.selectedAccountId, "googleDestination.selectedAccountId", "social");
      accessToken = requireString(googleConnection.accessToken, "googleConnection.accessToken", "social");
    } catch (validationError) {
      const errorMessage = validationError instanceof Error ? validationError.message : "Missing required field";
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // Optional fields (can be null)
    const refreshToken = googleConnection.refreshToken || null;
    const tokenExpiresAt = googleConnection.tokenExpiresAt || null;

    // Test post summary text
    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const testSummary = `OBD Social Auto-Poster test post ✅ (${timestamp})`;

    // OBD logo URL - use a stable hosted image
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const imageUrl = `${appUrl}/obd-logo.png`;

    // Publish to Google Business Profile
    const result = await publishToGoogleBusiness({
      locationId,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      summaryText: testSummary,
      imageUrl,
    });

    // Update connection with refreshed token if it was refreshed
    if (result.refreshedToken) {
      const tokenExpiresAt = new Date(Date.now() + result.refreshedToken.expiresIn * 1000);
      await prisma.socialAccountConnection.updateMany({
        where: {
          userId,
          platform: "google_business",
        },
        data: {
          accessToken: result.refreshedToken.accessToken,
          tokenExpiresAt,
        },
      });
    }

    // Log attempt
    await prisma.socialPublishAttempt.create({
      data: {
        userId,
        platform: "google_business",
        kind: "test",
        status: result.ok ? "success" : "failed",
        providerPostId: result.providerPostId,
        providerPermalink: result.providerPermalink,
        errorMessage: result.errorMessage,
      },
    });

    return NextResponse.json({
      ok: result.ok,
      result: {
        postId: result.providerPostId,
        permalink: result.providerPermalink,
        error: result.errorMessage,
      },
    });
  } catch (error) {
    console.error("Error in Google test post:", error);
    
    // Handle validation errors (400) vs publish failures (500)
    if (error instanceof Error && error.message.startsWith("[social]")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to publish test post" },
      { status: 500 }
    );
  }
}

