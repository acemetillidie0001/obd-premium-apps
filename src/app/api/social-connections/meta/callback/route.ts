import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { cookies } from "next/headers";
import { getMetaOAuthBaseUrl } from "@/lib/apps/social-auto-poster/getBaseUrl";

/**
 * GET /api/social-connections/meta/callback
 * 
 * Handles Meta OAuth callback:
 * - Validates state for CSRF protection
 * - Exchanges code for access token
 * - Fetches user's pages
 * - Gets page access tokens
 * - Stores Facebook connection
 * - Discovers and stores Instagram connection if available
 * - Redirects back to setup page
 */
export async function GET(request: NextRequest) {
  // Get base URL for redirects (NEXTAUTH_URL is required and must be HTTPS)
  let baseUrl: string;
  try {
    baseUrl = getMetaOAuthBaseUrl();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Base URL validation failed";
    console.error("[Meta OAuth Callback] Base URL validation failed:", errorMessage);
    // Fallback to request origin only for error redirects (should not happen in normal flow)
    baseUrl = request.nextUrl.origin;
    console.warn("[Meta OAuth Callback] Using request origin as fallback:", baseUrl);
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=unauthorized", baseUrl));
    }

    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=premium_required", baseUrl));
    }

    const userId = session.user.id;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      const errorDescription = searchParams.get("error_description") || "Unknown error";
      // Map common OAuth error codes
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
    const storedState = cookieStore.get("meta_oauth_state")?.value;
    const oauthType = cookieStore.get("meta_oauth_type")?.value; // "pages_access" or undefined

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=invalid_state", baseUrl));
    }

    // Clear state cookies
    cookieStore.delete("meta_oauth_state");
    cookieStore.delete("meta_oauth_type");

    // Get environment variables
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=not_configured", baseUrl));
    }

    // Use the same base URL for redirect URI (ensures consistency)
    const redirectUri = `${baseUrl}/api/social-connections/meta/callback`;
    
    // Log the computed redirect_uri for debugging (safe to log - no secrets)
    console.log("[Meta OAuth Callback] Computed redirect_uri:", redirectUri);
    
    // Runtime assertion: verify redirect_uri format matches what was sent to Facebook
    if (!redirectUri.startsWith("https://")) {
      const errorMsg = `Invalid redirect_uri: must use HTTPS. Got: ${redirectUri}`;
      console.error("[Meta OAuth Callback]", errorMsg);
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=invalid_redirect_uri", baseUrl));
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `client_id=${appId}&` +
        `client_secret=${appSecret}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `code=${code}`,
      {
        method: "GET",
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Meta token exchange failed:", errorText);
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=token_exchange_failed", baseUrl));
    }

    const tokenData = await tokenResponse.json();
    const userAccessToken = tokenData.access_token;

    if (!userAccessToken) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=no_access_token", baseUrl));
    }

    // Determine if this is a pages access request or basic connect
    const isPagesAccessRequest = oauthType === "pages_access";

    if (isPagesAccessRequest) {
      // Stage 2: Pages Access Request
      // Fetch user's pages with the new token
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${userAccessToken}`
      );

      if (!pagesResponse.ok) {
        const errorText = await pagesResponse.text();
        console.error("Meta pages fetch failed:", errorText);
        return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=pages_fetch_failed", baseUrl));
      }

      const pagesData = await pagesResponse.json();
      const pages = pagesData.data || [];

      if (pages.length === 0) {
        return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=no_pages", baseUrl));
      }

      // Select the first page that has a page access token
      let selectedPage = null;
      for (const page of pages) {
        if (page.access_token) {
          selectedPage = page;
          break;
        }
      }

      if (!selectedPage || !selectedPage.access_token) {
        return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=no_page_token", baseUrl));
      }

      // Update existing Facebook connection with pages access
      const existingConnection = await prisma.socialAccountConnection.findFirst({
        where: {
          userId,
          platform: "facebook",
        },
      });

      if (existingConnection) {
        // Update with page token and pages access info
        await prisma.socialAccountConnection.update({
          where: { id: existingConnection.id },
          data: {
            accessToken: selectedPage.access_token, // Page access token (long-lived)
            providerAccountId: selectedPage.id,
            displayName: selectedPage.name || "Facebook Page",
            metaJson: {
              ...(existingConnection.metaJson as Record<string, unknown> || {}),
              pageId: selectedPage.id,
              pageName: selectedPage.name,
              category: selectedPage.category,
              pagesAccessGranted: true,
              pagesAccessGrantedAt: new Date().toISOString(),
            },
          },
        });

        // Update or create Facebook destination selection
        await prisma.socialPostingDestination.upsert({
          where: {
            userId_platform: {
              userId,
              platform: "facebook",
            },
          },
          create: {
            userId,
            platform: "facebook",
            selectedAccountId: selectedPage.id,
            selectedDisplayName: selectedPage.name || "Facebook Page",
          },
          update: {
            selectedAccountId: selectedPage.id,
            selectedDisplayName: selectedPage.name || "Facebook Page",
          },
        });
      }

      // Redirect back to setup page with pages access success
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?pages_access=1", baseUrl));
    } else {
      // Stage 1: Basic Connect
      // Fetch basic user info
      const userInfoResponse = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${userAccessToken}`
      );

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.error("Meta user info fetch failed:", errorText);
        return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=user_info_failed", baseUrl));
      }

      const userInfo = await userInfoResponse.json();

      // Store basic Facebook connection (user-level, not page-level yet)
      await prisma.socialAccountConnection.upsert({
        where: {
          userId_platform_providerAccountId: {
            userId,
            platform: "facebook",
            providerAccountId: userInfo.id,
          },
        },
        create: {
          userId,
          platform: "facebook",
          providerAccountId: userInfo.id,
          displayName: userInfo.name || "Facebook Account",
          accessToken: userAccessToken, // User access token (basic)
          tokenExpiresAt: tokenData.expires_in 
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null,
          refreshToken: null,
          metaJson: {
            userId: userInfo.id,
            userName: userInfo.name,
            basicConnectGranted: true,
            basicConnectGrantedAt: new Date().toISOString(),
            pagesAccessGranted: false,
          },
        },
        update: {
          displayName: userInfo.name || "Facebook Account",
          accessToken: userAccessToken,
          tokenExpiresAt: tokenData.expires_in 
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null,
          metaJson: {
            userId: userInfo.id,
            userName: userInfo.name,
            basicConnectGranted: true,
            basicConnectGrantedAt: new Date().toISOString(),
            pagesAccessGranted: false,
          },
        },
      });

      // Redirect back to setup page with basic connect success
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?connected=1", baseUrl));
    }
  } catch (error) {
    console.error("Error in Meta OAuth callback:", error);
    // Use request origin as fallback for error redirects
    const errorBaseUrl = request.nextUrl.origin;
    return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=callback_failed", errorBaseUrl));
  }
}

