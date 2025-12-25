import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { cookies } from "next/headers";

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
      const errorDescription = searchParams.get("error_description") || "Unknown error";
      return NextResponse.redirect(new URL(`/apps/social-auto-poster/setup?error=${encodeURIComponent(errorDescription)}`, baseUrl));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=missing_params", baseUrl));
    }

    // Validate state cookie
    const cookieStore = await cookies();
    const storedState = cookieStore.get("meta_oauth_state")?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=invalid_state", baseUrl));
    }

    // Clear state cookie
    cookieStore.delete("meta_oauth_state");

    // Get environment variables
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appId || !appSecret || !appUrl) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=not_configured", baseUrl));
    }

    const redirectUri = `${appUrl}/api/social-connections/meta/callback`;

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

    // Fetch user's pages
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

    // Store Facebook connection
    await prisma.socialAccountConnection.upsert({
      where: {
        userId_platform_providerAccountId: {
          userId,
          platform: "facebook",
          providerAccountId: selectedPage.id,
        },
      },
      create: {
        userId,
        platform: "facebook",
        providerAccountId: selectedPage.id,
        displayName: selectedPage.name || "Facebook Page",
        accessToken: selectedPage.access_token, // Page access token (long-lived)
        tokenExpiresAt: null, // Page tokens don't expire
        refreshToken: null,
        metaJson: {
          pageId: selectedPage.id,
          pageName: selectedPage.name,
          category: selectedPage.category,
        },
      },
      update: {
        displayName: selectedPage.name || "Facebook Page",
        accessToken: selectedPage.access_token,
        tokenExpiresAt: null,
        metaJson: {
          pageId: selectedPage.id,
          pageName: selectedPage.name,
          category: selectedPage.category,
        },
      },
    });

    // Store Facebook destination selection
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

    // Try to discover Instagram business account
    try {
      const igResponse = await fetch(
        `https://graph.facebook.com/v21.0/${selectedPage.id}?` +
          `fields=instagram_business_account&` +
          `access_token=${selectedPage.access_token}`
      );

      if (igResponse.ok) {
        const igData = await igResponse.json();
        const igBusinessAccount = igData.instagram_business_account;

        if (igBusinessAccount && igBusinessAccount.id) {
          // Fetch IG account details
          const igDetailsResponse = await fetch(
            `https://graph.facebook.com/v21.0/${igBusinessAccount.id}?` +
              `fields=username,profile_picture_url&` +
              `access_token=${selectedPage.access_token}`
          );

          if (igDetailsResponse.ok) {
            const igDetails = await igDetailsResponse.json();

            // Store Instagram connection
            await prisma.socialAccountConnection.upsert({
              where: {
                userId_platform_providerAccountId: {
                  userId,
                  platform: "instagram",
                  providerAccountId: igBusinessAccount.id,
                },
              },
              create: {
                userId,
                platform: "instagram",
                providerAccountId: igBusinessAccount.id,
                displayName: igDetails.username || "Instagram Account",
                accessToken: selectedPage.access_token, // Use page token for IG
                tokenExpiresAt: null,
                refreshToken: null,
                metaJson: {
                  igBusinessId: igBusinessAccount.id,
                  username: igDetails.username,
                  profilePictureUrl: igDetails.profile_picture_url,
                },
              },
              update: {
                displayName: igDetails.username || "Instagram Account",
                accessToken: selectedPage.access_token,
                metaJson: {
                  igBusinessId: igBusinessAccount.id,
                  username: igDetails.username,
                  profilePictureUrl: igDetails.profile_picture_url,
                },
              },
            });

            // Store Instagram destination selection
            await prisma.socialPostingDestination.upsert({
              where: {
                userId_platform: {
                  userId,
                  platform: "instagram",
                },
              },
              create: {
                userId,
                platform: "instagram",
                selectedAccountId: igBusinessAccount.id,
                selectedDisplayName: igDetails.username || "Instagram Account",
              },
              update: {
                selectedAccountId: igBusinessAccount.id,
                selectedDisplayName: igDetails.username || "Instagram Account",
              },
            });
          }
        }
      }
    } catch (igError) {
      // Instagram discovery failed, but Facebook connection succeeded
      // This is acceptable - Facebook connection should not fail if IG is unavailable
      console.warn("Instagram discovery failed (non-blocking):", igError);
    }

    // Redirect back to setup page with success
    return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?connected=1", baseUrl));
  } catch (error) {
    console.error("Error in Meta OAuth callback:", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=callback_failed", baseUrl));
  }
}

