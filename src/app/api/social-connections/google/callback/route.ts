import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { listBusinessLocations } from "@/lib/apps/social-auto-poster/publishers/googleBusinessPublisher";

/**
 * GET /api/social-connections/google/callback
 * 
 * Handles Google OAuth callback:
 * - Validates state for CSRF protection
 * - Exchanges code for access token and refresh token
 * - Fetches Google Business Profile locations
 * - Stores connection and first location as default destination
 * - Redirects back to setup page
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=unauthorized", baseUrl));
    }

    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=premium_required", baseUrl));
    }

    const userId = session.user.id;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // Handle OAuth errors
    if (error) {
      let errorCode = error;
      if (error === "access_denied") {
        errorCode = "access_denied";
      } else if (error === "invalid_request") {
        errorCode = "invalid_request";
      }
      return NextResponse.redirect(new URL(`/apps/social-auto-poster/setup?error=${errorCode}`, baseUrl));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=missing_params", baseUrl));
    }

    // Validate state cookie
    const cookieStore = await cookies();
    const storedState = cookieStore.get("google_oauth_state")?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=invalid_state", baseUrl));
    }

    // Verify state JWT
    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "fallback-secret");
      const { payload } = await jwtVerify(storedState, secret);
      if (payload.userId !== userId) {
        return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=invalid_state", baseUrl));
      }
    } catch {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=invalid_state", baseUrl));
    }

    // Clear state cookie
    cookieStore.delete("google_oauth_state");

    // Get environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${appUrl}/api/social-connections/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=not_configured", baseUrl));
    }

    // Exchange code for access token and refresh token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Google token exchange failed:", errorText.substring(0, 200));
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=token_exchange_failed", baseUrl));
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600; // Default to 1 hour

    if (!accessToken) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=no_access_token", baseUrl));
    }

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Fetch user info to get account identifier
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error("Google user info fetch failed:", errorText.substring(0, 200));
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=user_info_failed", baseUrl));
    }

    const userInfo = await userInfoResponse.json();
    const providerAccountId = userInfo.id || userInfo.email || "unknown";
    const displayName = userInfo.email || userInfo.name || "Google Account";

    // Store Google connection
    await prisma.socialAccountConnection.upsert({
      where: {
        userId_platform_providerAccountId: {
          userId,
          platform: "google_business",
          providerAccountId: providerAccountId.toString(),
        },
      },
      create: {
        userId,
        platform: "google_business",
        providerAccountId: providerAccountId.toString(),
        displayName,
        accessToken,
        refreshToken: refreshToken || null,
        tokenExpiresAt,
        metaJson: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        },
      },
      update: {
        displayName,
        accessToken,
        refreshToken: refreshToken || null,
        tokenExpiresAt,
        metaJson: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        },
      },
    });

    // Fetch business locations
    const locationsResult = await listBusinessLocations({
      accessToken,
      refreshToken: refreshToken || null,
      tokenExpiresAt,
    });

    // If locations found, store first one as default destination
    if (locationsResult.ok && locationsResult.locations && locationsResult.locations.length > 0) {
      const firstLocation = locationsResult.locations[0];
      
      await prisma.socialPostingDestination.upsert({
        where: {
          userId_platform: {
            userId,
            platform: "google_business",
          },
        },
        create: {
          userId,
          platform: "google_business",
          selectedAccountId: firstLocation.id,
          selectedDisplayName: firstLocation.name,
        },
        update: {
          selectedAccountId: firstLocation.id,
          selectedDisplayName: firstLocation.name,
        },
      });
    }

    // Redirect back to setup page with success
    return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?google_connected=1", baseUrl));
  } catch (error) {
    console.error("Error in Google OAuth callback:", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=callback_failed", baseUrl));
  }
}

