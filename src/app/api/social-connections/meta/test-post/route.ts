import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { isMetaPublishingEnabled } from "@/lib/apps/social-auto-poster/metaConnectionStatus";
import { requireString } from "@/lib/utils/requireString";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { publishToFacebookPage, publishToInstagram } from "@/lib/apps/social-auto-poster/publishers/metaPublisher";
import { mapMetaApiErrorToStableCode } from "@/lib/apps/social-auto-poster/metaErrorMapper";

/**
 * POST /api/social-connections/meta/test-post
 * 
 * Publishes a test post to Facebook Page and/or Instagram.
 * Logs attempts to SocialPublishAttempt table.
 * 
 * Feature Flag: Requires META_PUBLISHING_ENABLED=true to actually publish.
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    let userId: string;
    let businessId: string;
    try {
      const ctx = await requirePermission("SOCIAL_AUTO_POSTER", "APPLY");
      userId = ctx.userId;
      businessId = ctx.businessId;
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

    // Check feature flag (manual-only posture still enforced by review-mode gates elsewhere)
    if (!isMetaPublishingEnabled()) {
      return NextResponse.json(
        { 
          ok: false,
          error: "PUBLISHING_DISABLED",
          message: "Facebook/Instagram publishing is in limited mode while we complete Meta App Review. You can still compose posts, queue them, and use simulate mode to preview how they'll look."
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const platforms = body.platforms as ("facebook" | "instagram")[] | undefined;

    // Prefer business-scoped connections; destinations are optional and user-scoped in schema.
    const fbConnection = await prisma.socialAccountConnection.findFirst({
      where: {
        userId,
        platform: "facebook",
        metaJson: { path: ["businessId"], equals: businessId },
      },
    });
    const igConnection = await prisma.socialAccountConnection.findFirst({
      where: {
        userId,
        platform: "instagram",
        metaJson: { path: ["businessId"], equals: businessId },
      },
    });

    // Determine which platforms to attempt
    const attemptFacebook = !platforms || platforms.includes("facebook");
    const attemptInstagram = (!platforms || platforms.includes("instagram")) && !!igConnection;

    const results: {
      facebook?: { ok: boolean; postId?: string; permalink?: string; error?: string; errorCode?: string };
      instagram?: { ok: boolean; postId?: string; permalink?: string; error?: string; errorCode?: string };
    } = {};

    // Test post caption
    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const testCaption = `OBD Social Auto-Poster test post ✅ (${timestamp})`;

    // OBD logo URL - use a stable hosted image
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const imageUrl = `${appUrl}/obd-logo.png`;

    // Attempt Facebook post
    if (attemptFacebook) {
      try {
        if (!fbConnection || !fbConnection.accessToken) {
          results.facebook = {
            ok: false,
            error: "Facebook connection not found",
          };
          
          // Log failure
          await prisma.socialPublishAttempt.create({
            data: {
              userId,
              platform: "facebook",
              kind: "test",
              status: "failed",
              errorMessage: "Facebook connection not found",
            },
          });
        } else {
          const fbMeta = (fbConnection.metaJson as Record<string, unknown> | null) || {};
          const selectedPageId = typeof (fbMeta as any).selectedPageId === "string" ? (fbMeta as any).selectedPageId : "";
          const selectedPageAccessToken =
            typeof (fbMeta as any).selectedPageAccessToken === "string" ? (fbMeta as any).selectedPageAccessToken : "";

          if (!selectedPageId || !selectedPageAccessToken) {
            results.facebook = { ok: false, error: "No Page selected. Select a Facebook Page first.", errorCode: "PAGE_ACCESS_DENIED" };
            await prisma.socialPublishAttempt.create({
              data: {
                userId,
                platform: "facebook",
                kind: "test",
                status: "failed",
                errorMessage: "No Page selected",
                responseData: { code: "PAGE_ACCESS_DENIED" } as any,
              },
            });
          } else {
            const pageId = requireString(selectedPageId, "selectedPageId", "social");
          const fbResult = await publishToFacebookPage({
            pageId,
            pageAccessToken: selectedPageAccessToken,
            message: testCaption,
          });

          if (!fbResult.ok) {
            const stable = mapMetaApiErrorToStableCode({ code: fbResult.errorCode, message: fbResult.errorMessage });
            results.facebook = { ok: false, error: stable.message, errorCode: stable.code };
            await prisma.socialPublishAttempt.create({
              data: {
                userId,
                platform: "facebook",
                kind: "test",
                status: "failed",
                errorMessage: stable.message.substring(0, 500),
                responseData: { code: stable.code } as any,
              },
            });
          } else {
            results.facebook = { ok: true, postId: fbResult.providerPostId, permalink: fbResult.permalink };
            await prisma.socialPublishAttempt.create({
              data: {
                userId,
                platform: "facebook",
                kind: "test",
                status: "success",
                providerPostId: fbResult.providerPostId,
                providerPermalink: fbResult.permalink,
              },
            });
          }
          }
        }
      } catch (error) {
        // Handle validation errors (400) vs publish failures (500)
        if (error instanceof Error && error.message.startsWith("[social]")) {
          // Validation error - return 400 immediately
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.facebook = {
          ok: false,
          error: errorMessage,
        };

        // Log failure
        await prisma.socialPublishAttempt.create({
          data: {
            userId,
            platform: "facebook",
            kind: "test",
            status: "failed",
            errorMessage: errorMessage.substring(0, 500),
          },
        });
      }
    }

    // Attempt Instagram post (only if Instagram is connected)
    if (attemptInstagram && igConnection) {
      try {
        if (!igConnection || !igConnection.accessToken) {
          results.instagram = {
            ok: false,
            error: "Instagram connection not found",
          };

          // Log failure
          await prisma.socialPublishAttempt.create({
            data: {
              userId,
              platform: "instagram",
              kind: "test",
              status: "failed",
              errorMessage: "Instagram connection not found",
            },
          });
        } else {
          const igBusinessId = requireString(igConnection.providerAccountId, "igConnection.providerAccountId", "social");
          const igResult = await publishToInstagram({
            igBusinessId,
            accessToken: igConnection.accessToken,
            caption: testCaption,
            imageUrl,
          });

          if (!igResult.ok) {
            const stable = mapMetaApiErrorToStableCode({ code: igResult.errorCode, message: igResult.errorMessage });
            results.instagram = { ok: false, error: stable.message, errorCode: stable.code };
            await prisma.socialPublishAttempt.create({
              data: {
                userId,
                platform: "instagram",
                kind: "test",
                status: "failed",
                errorMessage: stable.message.substring(0, 500),
                responseData: { code: stable.code } as any,
              },
            });
          } else {
            results.instagram = { ok: true, postId: igResult.providerPostId, permalink: igResult.permalink };
            await prisma.socialPublishAttempt.create({
              data: {
                userId,
                platform: "instagram",
                kind: "test",
                status: "success",
                providerPostId: igResult.providerPostId,
                providerPermalink: igResult.permalink,
              },
            });
          }
        }
      } catch (error) {
        // Handle validation errors (400) vs publish failures (500)
        if (error instanceof Error && error.message.startsWith("[social]")) {
          // Validation error - return 400 immediately
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.instagram = {
          ok: false,
          error: errorMessage,
        };

        // Log failure
        await prisma.socialPublishAttempt.create({
          data: {
            userId,
            platform: "instagram",
            kind: "test",
            status: "failed",
            errorMessage: errorMessage.substring(0, 500),
          },
        });
      }
    }

    const overallOk =
      Object.values(results).some((r) => r?.ok === true) || Object.keys(results).length === 0;

    // Reviewer-safe response (single-platform friendly) + backward compatible results map
    const singlePlatform =
      platforms && platforms.length === 1 ? platforms[0] : attemptFacebook ? "facebook" : "instagram";
    const primary = (results as any)?.[singlePlatform];
    const primaryErrorCode = primary?.errorCode || (primary?.ok === false ? "UNKNOWN" : undefined);

    return NextResponse.json({
      ok: overallOk,
      platform: singlePlatform,
      postId: primary?.postId,
      permalinkUrl: primary?.permalink,
      message: overallOk ? "Test post attempted." : "Test post failed.",
      error: !overallOk
        ? {
            code: primaryErrorCode,
            message: primary?.error || "Test post failed.",
          }
        : undefined,
      results,
    });
  } catch (error) {
    console.error("Error in test post:", error);
    
    // Handle validation errors (400) vs publish failures (500)
    if (error instanceof Error && error.message.startsWith("[social]")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: "Failed to publish test post" },
      { status: 500 }
    );
  }
}

