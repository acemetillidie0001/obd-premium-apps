import { NextRequest, NextResponse } from "next/server";
import { hasPremiumAccess } from "@/lib/premium";
import { cookies } from "next/headers";
import { getMetaOAuthBaseUrl } from "@/lib/apps/social-auto-poster/getBaseUrl";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { createMetaOAuthState } from "@/lib/apps/social-auto-poster/metaOAuthState";
import {
  META_OAUTH_SCOPES_BASIC,
  META_OAUTH_SCOPES_PAGES_ACCESS,
  META_OAUTH_SCOPES_PUBLISHING,
} from "@/lib/apps/social-auto-poster/metaOAuthScopes";

/**
 * POST /api/social-connections/meta/connect
 * 
 * Initiates Meta OAuth flow by generating an authorization URL.
 * Uses state parameter for CSRF protection.
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

    // TEMPORARY DEBUG: Log NEXTAUTH_URL
    const nextAuthUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
    console.log("[Meta OAuth Connect] DEBUG - NEXTAUTH_URL:", nextAuthUrl || "NOT SET");
    
    // Validate NEXTAUTH_URL in local dev
    if (process.env.NODE_ENV !== "production") {
      if (!nextAuthUrl) {
        const errorMsg = "NEXTAUTH_URL is required for Meta OAuth in local development. Set NEXTAUTH_URL to your ngrok HTTPS URL (e.g., https://<subdomain>.ngrok-free.dev)";
        console.error("[Meta OAuth Connect] DEBUG -", errorMsg);
        return NextResponse.json(
          { error: errorMsg },
          { status: 500 }
        );
      }
      if (!nextAuthUrl.startsWith("https://")) {
        const errorMsg = `NEXTAUTH_URL must use HTTPS for Meta OAuth. Current value: ${nextAuthUrl}. For local development, use ngrok (https://<subdomain>.ngrok-free.dev)`;
        console.error("[Meta OAuth Connect] DEBUG -", errorMsg);
        return NextResponse.json(
          { error: errorMsg },
          { status: 500 }
        );
      }
    }

    // Get base URL for redirect URI (NEXTAUTH_URL is required and must be HTTPS)
    let baseUrl: string;
    try {
      baseUrl = getMetaOAuthBaseUrl();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Base URL validation failed";
      console.error("[Meta OAuth Connect] Base URL validation failed:", errorMessage);
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    // Build redirect URI (ensure no trailing slashes, no extra params)
    const redirectUri = `${baseUrl}/api/social-connections/meta/callback`;
    
    // TEMPORARY DEBUG: Log computed redirect_uri
    console.log("[Meta OAuth Connect] DEBUG - Computed redirect_uri:", redirectUri);
    
    // TEMPORARY DEBUG: Verify redirect_uri format matches expected pattern
    const expectedPattern = /^https:\/\/[^\/]+\.ngrok-free\.dev\/api\/social-connections\/meta\/callback$/;
    if (process.env.NODE_ENV !== "production") {
      if (!expectedPattern.test(redirectUri)) {
        console.warn("[Meta OAuth Connect] DEBUG - redirect_uri does not match expected ngrok pattern:", redirectUri);
        console.warn("[Meta OAuth Connect] DEBUG - Expected format: https://<subdomain>.ngrok-free.dev/api/social-connections/meta/callback");
      } else {
        console.log("[Meta OAuth Connect] DEBUG - redirect_uri format validation: ✓ PASSED");
      }
    }
    
    // Runtime assertion: verify redirect_uri format
    if (!redirectUri.startsWith("https://")) {
      const errorMsg = `Invalid redirect_uri: must use HTTPS. Got: ${redirectUri}`;
      console.error("[Meta OAuth Connect]", errorMsg);
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      );
    }
    
    if (redirectUri.includes("//api") || redirectUri.endsWith("/")) {
      const errorMsg = `Invalid redirect_uri format: contains double slashes or trailing slash. Got: ${redirectUri}`;
      console.error("[Meta OAuth Connect]", errorMsg);
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      );
    }

    const flowParam = request.nextUrl.searchParams.get("flow");
    const flow =
      flowParam === "publishing" || flowParam === "pages_access" || flowParam === "basic"
        ? flowParam
        : "basic";

    // Create signed state token (includes businessId, time-limited)
    const { state, nonce } = createMetaOAuthState({
      userId: ctx.userId,
      businessId: ctx.businessId,
      flow,
    });

    // Store nonce in httpOnly cookie (optional extra CSRF hardening; callback may still work without cookies)
    const cookieStore = await cookies();
    cookieStore.set("meta_oauth_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });
    cookieStore.set("meta_oauth_flow", flow, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    
    const scopesRequested =
      flow === "publishing"
        ? [...META_OAUTH_SCOPES_PUBLISHING]
        : flow === "pages_access"
          ? [...META_OAUTH_SCOPES_PAGES_ACCESS]
          : [...META_OAUTH_SCOPES_BASIC];
    const scopes = scopesRequested.join(",");

    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("response_type", "code");

    // TEMPORARY DEBUG: Log full Facebook OAuth URL (without state for security)
    const debugAuthUrl = new URL(authUrl.toString());
    debugAuthUrl.searchParams.set("state", "[REDACTED]");
    console.log("[Meta OAuth Connect] DEBUG - Full Facebook OAuth URL:", debugAuthUrl.toString());
    console.log("[Meta OAuth Connect] DEBUG - redirect_uri parameter:", redirectUri);
    console.log("[Meta OAuth Connect] DEBUG - client_id:", appId);
    console.log("[Meta OAuth Connect] DEBUG - scope:", scopes);

    return NextResponse.json({
      ok: true,
      authUrl: authUrl.toString(),
      scopesRequested,
    });
  } catch (error) {
    console.error("Error initiating Meta OAuth:", error);
    return NextResponse.json(
      { ok: false, code: "REQUEST_FAILED", message: "Failed to initiate connection" },
      { status: 500 }
    );
  }
}

