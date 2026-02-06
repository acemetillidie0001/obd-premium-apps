import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { isMetaReviewMode } from "@/lib/premium";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";
import { isMetaPublishingEnabled } from "@/lib/apps/social-auto-poster/metaConnectionStatus";
import {
  getMissingMetaScopes,
  META_PUBLISHING_REQUIRED_SCOPES,
} from "@/lib/apps/social-auto-poster/metaOAuthScopes";

/**
 * GET /api/social-connections/meta/status
 * 
 * Returns the Meta (Facebook/Instagram) connection status for the current user.
 * Never returns tokens.
 * Never returns 500 - always returns structured error responses.
 */
export async function GET() {
  try {
    const reviewMode = isMetaReviewMode();
    const publishingEnabled = isMetaPublishingEnabled();

    // Check if Meta is configured (env vars) - check early for consistent responses
    const metaAppId = process.env.META_APP_ID;
    const metaAppSecret = process.env.META_APP_SECRET;
    const configured = !!(metaAppId && metaAppSecret);

    // Tenant/business guard (fail closed)
    let tenant: { userId: string; businessId: string } | null = null;
    try {
      const t = await requireTenant();
      await requirePermission("SOCIAL_AUTO_POSTER", "VIEW");
      tenant = { userId: t.userId, businessId: t.businessId };
    } catch (err) {
      if (err instanceof BusinessContextError) {
        const code = err.status === 401 ? "AUTH_REQUIRED" : "BUSINESS_CONTEXT_REQUIRED";
        return NextResponse.json(
          {
            ok: false,
            configured,
            metaReviewMode: reviewMode,
            errorCode: code,
            errorMessage: err.message,
            requiredScopesMissing: [],
            facebook: { connected: false },
            instagram: { connected: false, available: false },
          },
          { status: err.status }
        );
      }
      // Unknown error - return safe structured response
      return NextResponse.json(
        {
          ok: false,
          configured,
          metaReviewMode: reviewMode,
          errorCode: "UNKNOWN_ERROR",
          errorMessage: "Unable to verify tenant context.",
          requiredScopesMissing: [],
          facebook: { connected: false },
          instagram: { connected: false, available: false },
        },
        { status: 200 }
      );
    }

    // Check premium access
    let hasAccess: boolean;
    try {
      hasAccess = await hasPremiumAccess();
    } catch (error) {
      console.error("[Meta Status] Error checking premium access:", error);
      return NextResponse.json(
        {
          ok: false,
          configured,
          metaReviewMode: reviewMode,
          errorCode: "PREMIUM_CHECK_FAILED",
          error: "Unable to verify premium access"
        },
        { status: 200 }
      );
    }

    if (!hasAccess) {
      return NextResponse.json(
        { 
          ok: false,
          configured,
          metaReviewMode: reviewMode,
          errorCode: "PREMIUM_REQUIRED",
          error: "Premium access required"
        },
        { status: 403 }
      );
    }

    const userId = tenant.userId;
    const businessId = tenant.businessId;

    if (!configured) {
      // Determine which env var is missing for clearer error message
      const missingVars: string[] = [];
      if (!metaAppId) missingVars.push("META_APP_ID");
      if (!metaAppSecret) missingVars.push("META_APP_SECRET");
      const configuredReason = missingVars.length > 0 
        ? `missing ${missingVars.join(" and ")}`
        : "Meta app not configured";

      return NextResponse.json({
        ok: true,
        connected: false,
        reviewMode,
        publishingEnabled,
        token: { present: false, expiresAt: null, scopes: [], isExpired: false },
        assets: { pageSelected: false, pageId: null, igBusinessId: null },
        requiredScopesMissing: [],
        nextSteps: ["Configure META_APP_ID and META_APP_SECRET"],
        configured: false,
        metaReviewMode: reviewMode,
        configuredReason,
        errorCode: "META_NOT_CONFIGURED",
        facebook: {
          connected: false,
        },
        instagram: {
          connected: false,
          available: false,
        },
      });
    }

    // Fetch connections from database
    let facebookConnection = null;
    let instagramConnection = null;
    let facebookDestination = null;
    let instagramDestination = null;

    try {
      // Fetch Facebook connection
      facebookConnection = await prisma.socialAccountConnection.findFirst({
        where: {
          userId,
          platform: "facebook",
          metaJson: {
            path: ["businessId"],
            equals: businessId,
          },
        },
      });

      // Fetch Instagram connection
      instagramConnection = await prisma.socialAccountConnection.findFirst({
        where: {
          userId,
          platform: "instagram",
          metaJson: {
            path: ["businessId"],
            equals: businessId,
          },
        },
      });

      // Fetch destination selections
      facebookDestination = await prisma.socialPostingDestination.findUnique({
        where: {
          userId_platform: {
            userId,
            platform: "facebook",
          },
        },
      });

      instagramDestination = await prisma.socialPostingDestination.findUnique({
        where: {
          userId_platform: {
            userId,
            platform: "instagram",
          },
        },
      });
    } catch (dbError) {
      // Database error - likely schema mismatch or table missing
      console.error("[Meta Status] Database error:", dbError instanceof Error ? dbError.message : "Unknown database error");
      
      return NextResponse.json({
        ok: false,
        configured: true,
        metaReviewMode: reviewMode,
        errorCode: "DB_ERROR",
        errorMessage: "Database not ready for social connections.",
        facebook: {
          connected: false,
        },
        instagram: {
          connected: false,
          available: false,
        },
      });
    }

    // Extract permission info from metaJson
    const facebookMeta = facebookConnection?.metaJson as Record<string, unknown> | null;
    const pagesAccessGranted = facebookMeta?.pagesAccessGranted === true;
    const basicConnectGranted = facebookMeta?.basicConnectGranted === true;

    // Build successful response
    const connected = !!facebookConnection;
    const tokenExpiresAt = facebookConnection?.tokenExpiresAt ?? null;
    const isExpired = tokenExpiresAt ? tokenExpiresAt.getTime() <= Date.now() : false;
    const requestedScopes = Array.isArray((facebookMeta as any)?.scopesRequested)
      ? ((facebookMeta as any).scopesRequested as string[]).filter((s) => typeof s === "string")
      : [];
    const requiredScopesMissing = connected
      ? getMissingMetaScopes(META_PUBLISHING_REQUIRED_SCOPES, requestedScopes)
      : [];
    const selectedPageId = typeof (facebookMeta as any)?.selectedPageId === "string" ? (facebookMeta as any).selectedPageId : null;
    const pageId = pagesAccessGranted ? selectedPageId : null;
    const pageSelected = !!pageId;
    const igBusinessId = instagramConnection?.providerAccountId ?? null;

    const nextSteps: string[] = [];
    if (!configured) nextSteps.push("Configure META_APP_ID and META_APP_SECRET");
    if (!connected) nextSteps.push("Connect Meta");
    if (connected && isExpired) nextSteps.push("Reconnect (token expired)");
    if (connected && !pagesAccessGranted) nextSteps.push("Enable Pages Access");
    if (connected && requiredScopesMissing.includes("pages_manage_posts")) nextSteps.push("Request Publishing Access");
    if (connected && pagesAccessGranted && !pageSelected) nextSteps.push("Select a Facebook Page");
    if (connected && pagesAccessGranted && pageSelected && !igBusinessId) nextSteps.push("Link an Instagram Business account to this Page");
    if (connected && pagesAccessGranted && !publishingEnabled) nextSteps.push("Publishing disabled until META_PUBLISHING_ENABLED=true");

    const response = {
      // Required reviewer-safe shape (Prompt 3)
      ok: true,
      connected,
      reviewMode,
      publishingEnabled,
      token: {
        present: !!facebookConnection?.accessToken,
        expiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
        scopes: requestedScopes,
        isExpired,
      },
      assets: {
        pageSelected,
        pageId,
        igBusinessId,
      },
      requiredScopesMissing,
      nextSteps,

      // Backward-compatible fields used by existing UI
      configured,
      metaReviewMode: reviewMode,
      facebook: {
        connected: !!facebookConnection,
        basicConnectGranted: basicConnectGranted || false,
        pagesAccessGranted: pagesAccessGranted || false,
        pageName: facebookConnection?.displayName || facebookDestination?.selectedDisplayName || undefined,
        pageId: pageId || undefined,
      },
      instagram: {
        connected: !!instagramConnection,
        available: requiredScopesMissing.length === 0, // Publishing permissions granted (as recorded)
        username: instagramConnection?.displayName || instagramDestination?.selectedDisplayName || undefined,
        igBusinessId: instagramConnection?.providerAccountId || undefined,
        reasonIfUnavailable: !pagesAccessGranted
          ? "Pages access must be enabled first"
          : requiredScopesMissing.length > 0
            ? "Publishing requires additional Meta permissions. Request Publishing Access."
            : undefined,
      },
      publishing: {
        enabled: publishingEnabled,
        reasonIfDisabled: publishingEnabled
          ? undefined
          : "Publishing requires additional Meta setup: Advanced Access and App Review for pages_manage_posts and instagram_content_publish permissions.",
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    // Catch-all for unexpected errors
    console.error("[Meta Status] Unexpected error:", error instanceof Error ? error.message : "Unknown error");
    
    // Check configured status even in error case
    const configured = !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
    
    return NextResponse.json(
      {
        ok: false,
        configured,
        metaReviewMode: isMetaReviewMode(),
        errorCode: "UNKNOWN_ERROR",
        errorMessage: "Unable to load connection status. Please refresh or try again.",
        facebook: {
          connected: false,
        },
        instagram: {
          connected: false,
          available: false,
        },
      },
      { status: 200 }
    );
  }
}

