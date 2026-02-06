import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { cookies } from "next/headers";
import { getMetaOAuthBaseUrl } from "@/lib/apps/social-auto-poster/getBaseUrl";
import { verifyMetaOAuthState } from "@/lib/apps/social-auto-poster/metaOAuthState";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import {
  META_OAUTH_SCOPES_PAGES_ACCESS,
  META_OAUTH_SCOPES_PUBLISHING,
} from "@/lib/apps/social-auto-poster/metaOAuthScopes";

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

    const sessionUserId = session.user.id;

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

    // Validate signed state (must carry businessId + userId + flow)
    const parsedState = verifyMetaOAuthState(state);
    if (!parsedState) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=invalid_state", baseUrl));
    }
    if (parsedState.userId !== sessionUserId) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=invalid_state", baseUrl));
    }

    // Enforce tenant context based on derived businessId (fail closed)
    try {
      await requirePermission(
        { requestedBusinessId: parsedState.businessId },
        "SOCIAL_AUTO_POSTER",
        "APPLY"
      );
    } catch (err) {
      if (err instanceof BusinessContextError) {
        return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=unauthorized", baseUrl));
      }
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=unauthorized", baseUrl));
    }

    const userId = sessionUserId;
    const businessId = parsedState.businessId;
    const flow = parsedState.flow; // "basic" | "pages_access" | "publishing"

    // Optional extra CSRF hardening: compare nonce cookie if present (callback may work without cookies)
    const cookieStore = await cookies();
    const storedNonce = cookieStore.get("meta_oauth_nonce")?.value;
    if (storedNonce && storedNonce !== parsedState.nonce) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=invalid_state", baseUrl));
    }

    // Clear state cookies
    cookieStore.delete("meta_oauth_nonce");
    cookieStore.delete("meta_oauth_flow");

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
    const shortLivedAccessToken = tokenData.access_token as string | undefined;

    if (!shortLivedAccessToken) {
      return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=no_access_token", baseUrl));
    }

    // Exchange for long-lived token (deterministic; improves review friendliness)
    let userAccessToken = shortLivedAccessToken;
    let tokenExpiresAt: Date | null = null;
    try {
      const longResp = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
          `grant_type=fb_exchange_token&` +
          `client_id=${appId}&` +
          `client_secret=${appSecret}&` +
          `fb_exchange_token=${encodeURIComponent(shortLivedAccessToken)}`,
        { method: "GET" }
      );
      if (longResp.ok) {
        const longData = await longResp.json().catch(() => ({} as any));
        if (typeof longData.access_token === "string" && longData.access_token.length > 0) {
          userAccessToken = longData.access_token;
          if (typeof longData.expires_in === "number") {
            tokenExpiresAt = new Date(Date.now() + longData.expires_in * 1000);
          }
        }
      } else {
        // Non-fatal: proceed with short-lived token
        const txt = await longResp.text().catch(() => "");
        console.warn("[Meta OAuth Callback] Long-lived exchange failed (non-fatal):", txt.substring(0, 200));
      }
    } catch (err) {
      console.warn("[Meta OAuth Callback] Long-lived exchange exception (non-fatal):", err instanceof Error ? err.message : String(err));
    }

    // Determine which staged flow is completing
    const isPagesAccessRequest = flow === "pages_access";
    const isPublishingRequest = flow === "publishing";

    if (isPagesAccessRequest || isPublishingRequest) {
      // Stage 2: Pages Access Request
      // Fetch user's pages with the new token (verification only; selection happens via /meta/pages + /meta/select-page)
      const pagesResponse = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${userAccessToken}`);

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

      // Update existing Facebook connection with staged access
      const existingConnection = await prisma.socialAccountConnection.findFirst({
        where: {
          userId,
          platform: "facebook",
          metaJson: {
            path: ["businessId"],
            equals: businessId,
          },
        },
      });

      if (!existingConnection) {
        return NextResponse.redirect(new URL("/apps/social-auto-poster/setup?error=invalid_state", baseUrl));
      }

      // Update with staged access info (keep user token; do not auto-select a page)
      const existingMeta = (existingConnection.metaJson as Record<string, unknown> | null) || {};
      const prevScopes = Array.isArray((existingMeta as any).scopesRequested)
        ? ((existingMeta as any).scopesRequested as unknown[]).filter((s) => typeof s === "string") as string[]
        : [];
      const scopesToAdd = isPublishingRequest ? [...META_OAUTH_SCOPES_PUBLISHING] : [...META_OAUTH_SCOPES_PAGES_ACCESS];
      const nextScopes = Array.from(new Set([...prevScopes, ...scopesToAdd]));

      await prisma.socialAccountConnection.update({
        where: { id: existingConnection.id },
        data: {
          accessToken: userAccessToken, // user long-lived token (preferred)
          tokenExpiresAt,
          metaJson: {
            ...existingMeta,
            businessId,
            pagesAccessGranted: true,
            pagesAccessGrantedAt: new Date().toISOString(),
            publishingAccessGranted: isPublishingRequest ? true : ((existingMeta as any).publishingAccessGranted === true),
            publishingAccessGrantedAt: isPublishingRequest ? new Date().toISOString() : (existingMeta as any).publishingAccessGrantedAt,
            scopesRequested: nextScopes,
          },
        },
      });

      // Redirect back to setup page with staged access success
      return NextResponse.redirect(
        new URL(isPublishingRequest ? "/apps/social-auto-poster/setup?publishing_access=1" : "/apps/social-auto-poster/setup?pages_access=1", baseUrl)
      );
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
          accessToken: userAccessToken, // user access token (prefer long-lived)
          tokenExpiresAt,
          refreshToken: null,
          metaJson: {
            businessId,
            userId: userInfo.id,
            userName: userInfo.name,
            basicConnectGranted: true,
            basicConnectGrantedAt: new Date().toISOString(),
            pagesAccessGranted: false,
            scopesRequested: ["public_profile"],
            connectedAt: new Date().toISOString(),
          },
        },
        update: {
          displayName: userInfo.name || "Facebook Account",
          accessToken: userAccessToken,
          tokenExpiresAt,
          metaJson: {
            businessId,
            userId: userInfo.id,
            userName: userInfo.name,
            basicConnectGranted: true,
            basicConnectGrantedAt: new Date().toISOString(),
            pagesAccessGranted: false,
            scopesRequested: ["public_profile"],
            connectedAt: new Date().toISOString(),
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

