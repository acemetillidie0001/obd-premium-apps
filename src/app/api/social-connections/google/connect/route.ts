import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPremiumAccess } from "@/lib/premium";
import { cookies } from "next/headers";
import { SignJWT } from "jose";

/**
 * POST /api/social-connections/google/connect
 * 
 * Initiates Google OAuth flow for Business Profile access.
 * Returns OAuth URL with CSRF state protection.
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

    // Check environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${appUrl}/api/social-connections/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google OAuth not configured" },
        { status: 500 }
      );
    }

    // Generate CSRF state token
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "fallback-secret");
    const state = await new SignJWT({ userId: session.user.id, timestamp: Date.now() })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(secret);

    // Store state in signed cookie
    const cookieStore = await cookies();
    cookieStore.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Required scopes for Google Business Profile
    const scopes = [
      "https://www.googleapis.com/auth/business.manage",
      "https://www.googleapis.com/auth/plus.business.manage",
    ].join(" ");

    // Build OAuth URL
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("access_type", "offline"); // Required for refresh token
    authUrl.searchParams.set("prompt", "consent"); // Force consent screen to get refresh token

    return NextResponse.json({ ok: true, authUrl: authUrl.toString() });
  } catch (error) {
    console.error("[Google Connect] Error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to initiate Google OAuth" },
      { status: 500 }
    );
  }
}

