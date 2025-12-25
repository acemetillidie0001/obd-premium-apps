import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPremiumAccess } from "@/lib/premium";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

/**
 * POST /api/social-connections/meta/connect
 * 
 * Initiates Meta OAuth flow by generating an authorization URL.
 * Uses state parameter for CSRF protection.
 */
export async function POST() {
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: "Meta connection not configured" },
        { status: 500 }
      );
    }

    if (!appUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL not configured" },
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

    // Build Meta OAuth URL
    const redirectUri = `${appUrl}/api/social-connections/meta/callback`;
    
    // Minimal scopes for Pages + IG discovery and posting
    // pages_show_list: List pages user manages
    // pages_read_engagement: Read page info
    // pages_manage_posts: Publish to pages
    // instagram_basic: Basic Instagram access
    // instagram_content_publish: Publish to Instagram
    // business_management: Access to IG business accounts
    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "instagram_basic",
      "instagram_content_publish",
      "business_management",
    ].join(",");

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
    });
  } catch (error) {
    console.error("Error initiating Meta OAuth:", error);
    return NextResponse.json(
      { error: "Failed to initiate connection" },
      { status: 500 }
    );
  }
}

