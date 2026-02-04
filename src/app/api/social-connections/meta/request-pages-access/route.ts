import { NextRequest, NextResponse } from "next/server";
import { hasPremiumAccess } from "@/lib/premium";
import { cookies } from "next/headers";
import { getMetaOAuthBaseUrl } from "@/lib/apps/social-auto-poster/getBaseUrl";
import { prisma } from "@/lib/prisma";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { createMetaOAuthState } from "@/lib/apps/social-auto-poster/metaOAuthState";

/**
 * POST /api/social-connections/meta/request-pages-access
 * 
 * Initiates Meta OAuth flow to request Pages access permissions.
 * This is Stage 2 of the staged permission strategy.
 * Requests: pages_show_list, pages_read_engagement
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    let ctx: { userId: string; businessId: string } | null = null;
    try {
      const context = await requirePermission("SOCIAL_AUTO_POSTER", "APPLY");
      ctx = { userId: context.userId, businessId: context.businessId };
    } catch (err) {
      if (err instanceof BusinessContextError) {
        const code = err.status === 401 ? "AUTH_REQUIRED" : "BUSINESS_CONTEXT_REQUIRED";
        return NextResponse.json(
          { ok: false, code, message: err.message },
          { status: err.status }
        );
      }
      return NextResponse.json(
        { ok: false, code: "BUSINESS_CONTEXT_REQUIRED", message: "Business context required" },
        { status: 403 }
      );
    }

    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Premium access required" },
        { status: 403 }
      );
    }

    // Check if Meta is configured
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { ok: false, code: "META_ENV_MISSING", message: "Meta connection not configured (META_APP_ID/META_APP_SECRET missing)" },
        { status: 500 }
      );
    }

    // Verify user has basic Facebook connection first
    const userId = ctx.userId;
    const basicConnection = await prisma.socialAccountConnection.findFirst({
      where: {
        userId,
        platform: "facebook",
        metaJson: {
          path: ["businessId"],
          equals: ctx.businessId,
        },
      },
    });

    if (!basicConnection) {
      return NextResponse.json(
        { error: "Please connect Facebook first" },
        { status: 400 }
      );
    }

    // Get base URL for redirect URI (NEXTAUTH_URL is required and must be HTTPS)
    let baseUrl: string;
    try {
      baseUrl = getMetaOAuthBaseUrl();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Base URL validation failed";
      console.error("[Meta OAuth Request Pages Access] Base URL validation failed:", errorMessage);
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    // Create signed state token (includes businessId, time-limited)
    const { state, nonce } = createMetaOAuthState({
      userId: ctx.userId,
      businessId: ctx.businessId,
      flow: "pages_access",
    });

    // Store nonce + flow in httpOnly cookies (optional extra CSRF hardening)
    const cookieStore = await cookies();
    cookieStore.set("meta_oauth_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });
    cookieStore.set("meta_oauth_flow", "pages_access", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Build redirect URI (ensure no trailing slashes, no extra params)
    const redirectUri = `${baseUrl}/api/social-connections/meta/callback`;
    
    // Log the computed redirect_uri for debugging (safe to log - no secrets)
    console.log("[Meta OAuth Request Pages Access] Computed redirect_uri:", redirectUri);
    
    // Runtime assertion: verify redirect_uri format
    if (!redirectUri.startsWith("https://")) {
      const errorMsg = `Invalid redirect_uri: must use HTTPS. Got: ${redirectUri}`;
      console.error("[Meta OAuth Request Pages Access]", errorMsg);
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      );
    }
    
    if (redirectUri.includes("//api") || redirectUri.endsWith("/")) {
      const errorMsg = `Invalid redirect_uri format: contains double slashes or trailing slash. Got: ${redirectUri}`;
      console.error("[Meta OAuth Request Pages Access]", errorMsg);
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      );
    }
    
    // Stage 2: Request Pages access scopes only
    // pages_show_list: List pages user manages
    // pages_read_engagement: Read page info
    const scopesRequested = ["pages_show_list", "pages_read_engagement"];
    const scopes = scopesRequested.join(",");

    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("response_type", "code");

    // Do NOT log the authUrl with sensitive params
    return NextResponse.json({
      ok: true,
      authUrl: authUrl.toString(),
      scopesRequested,
    });
  } catch (error) {
    console.error("Error initiating Meta Pages access request:", error);
    return NextResponse.json(
      { ok: false, code: "REQUEST_FAILED", message: "Failed to initiate pages access request" },
      { status: 500 }
    );
  }
}

