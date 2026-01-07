import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPremiumAccess } from "@/lib/premium";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getMetaOAuthBaseUrl } from "@/lib/apps/social-auto-poster/getBaseUrl";

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

    // Check if Meta is configured
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: "Meta connection not configured" },
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

    // Generate state token for CSRF protection
    const state = randomBytes(32).toString("hex");
    
    // Store state in signed cookie (expires in 10 minutes)
    const cookieStore = await cookies();
    cookieStore.set("meta_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });
    
    // Stage 1: Minimal scopes for basic connection only
    // public_profile: Basic user profile information
    const scopes = ["public_profile"].join(",");

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
    });
  } catch (error) {
    console.error("Error initiating Meta OAuth:", error);
    return NextResponse.json(
      { error: "Failed to initiate connection" },
      { status: 500 }
    );
  }
}

