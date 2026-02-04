import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { mapMetaApiErrorToStableCode } from "@/lib/apps/social-auto-poster/metaErrorMapper";

/**
 * POST /api/social-connections/meta/select-page
 *
 * Persists selected Facebook Page and detects linked Instagram Business account.
 * Manual-only. No background behavior.
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
        return NextResponse.json({ ok: false, error: { code, message: err.message } }, { status: err.status });
      }
      return NextResponse.json(
        { ok: false, error: { code: "BUSINESS_CONTEXT_REQUIRED", message: "Business context required" } },
        { status: 403 }
      );
    }

    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { ok: false, error: { code: "PREMIUM_REQUIRED", message: "Premium access required" } },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { pageId?: string };
    const pageId = (body.pageId || "").trim();
    if (!pageId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "pageId is required" } },
        { status: 400 }
      );
    }

    const fbConnection = await prisma.socialAccountConnection.findFirst({
      where: {
        userId,
        platform: "facebook",
        metaJson: { path: ["businessId"], equals: businessId },
      },
    });

    if (!fbConnection?.accessToken) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_CONNECTED", message: "Facebook connection not found" } },
        { status: 400 }
      );
    }

    if (fbConnection.tokenExpiresAt && fbConnection.tokenExpiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { ok: false, error: { code: "TOKEN_EXPIRED", message: "Token expired. Please reconnect." } },
        { status: 401 }
      );
    }

    // Discover pages and validate ownership
    const accountsUrl =
      "https://graph.facebook.com/v21.0/me/accounts" +
      `?fields=${encodeURIComponent("id,name,tasks,access_token")}` +
      `&access_token=${encodeURIComponent(fbConnection.accessToken)}`;
    const accountsResp = await fetch(accountsUrl, { method: "GET" });
    const accountsData = await accountsResp.json().catch(() => ({}));
    if (!accountsResp.ok) {
      const metaErr = (accountsData as any)?.error || {};
      const stable = mapMetaApiErrorToStableCode({
        code: metaErr?.code,
        message: metaErr?.message,
        type: metaErr?.type,
      });
      return NextResponse.json(
        { ok: false, error: { code: stable.code, message: stable.message } },
        { status: stable.code === "TOKEN_EXPIRED" ? 401 : 403 }
      );
    }

    const pagesRaw: Array<{ id?: string; name?: string; tasks?: string[]; access_token?: string }> = Array.isArray(
      (accountsData as any)?.data
    )
      ? (accountsData as any).data
      : [];

    const match = pagesRaw.find((p) => p.id === pageId) || null;
    if (!match || typeof match.name !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "PAGE_ACCESS_DENIED", message: "Page not found or not managed by this account." } },
        { status: 403 }
      );
    }

    const tasks = Array.isArray(match.tasks) ? match.tasks : [];
    const canPublish = tasks.includes("CREATE_CONTENT") || tasks.includes("MANAGE");
    if (!canPublish) {
      return NextResponse.json(
        { ok: false, error: { code: "PAGE_ACCESS_DENIED", message: "You do not have publishing access to this Page." } },
        { status: 403 }
      );
    }

    const pageAccessToken = typeof match.access_token === "string" ? match.access_token : "";
    if (!pageAccessToken) {
      return NextResponse.json(
        { ok: false, error: { code: "PERMISSION_MISSING", message: "Page access token not available. Reconnect and grant Pages permissions." } },
        { status: 403 }
      );
    }

    // Persist selection to business-scoped Facebook connection metaJson
    const fbMeta = (fbConnection.metaJson as Record<string, unknown> | null) || {};
    await prisma.socialAccountConnection.update({
      where: { id: fbConnection.id },
      data: {
        metaJson: {
          ...fbMeta,
          businessId,
          selectedPageId: pageId,
          selectedPageName: match.name,
          selectedPageAccessToken: pageAccessToken,
          selectedPageSelectedAt: new Date().toISOString(),
        },
      },
    });

    // Also persist to user-scoped destination for UI convenience
    await prisma.socialPostingDestination.upsert({
      where: { userId_platform: { userId, platform: "facebook" } },
      create: { userId, platform: "facebook", selectedAccountId: pageId, selectedDisplayName: match.name },
      update: { selectedAccountId: pageId, selectedDisplayName: match.name },
    });

    // Detect linked Instagram Business account
    const igUrl =
      `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}` +
      `?fields=${encodeURIComponent("instagram_business_account{id,username}")}` +
      `&access_token=${encodeURIComponent(pageAccessToken)}`;
    const igResp = await fetch(igUrl, { method: "GET" });
    const igData = await igResp.json().catch(() => ({}));
    if (!igResp.ok) {
      const metaErr = (igData as any)?.error || {};
      const stable = mapMetaApiErrorToStableCode({
        code: metaErr?.code,
        message: metaErr?.message,
        type: metaErr?.type,
      });
      // Non-fatal for page selection: return page ok, ig not connected
      return NextResponse.json({
        ok: true,
        page: { pageId, name: match.name },
        instagram: { connected: false, igBusinessId: null, username: null },
        warning: { code: stable.code, message: stable.message },
      });
    }

    const igBusiness = (igData as any)?.instagram_business_account || null;
    const igBusinessId = typeof igBusiness?.id === "string" ? igBusiness.id : null;
    const igUsername = typeof igBusiness?.username === "string" ? igBusiness.username : null;

    if (igBusinessId) {
      // Upsert business-scoped Instagram connection
      await prisma.socialAccountConnection.upsert({
        where: {
          userId_platform_providerAccountId: {
            userId,
            platform: "instagram",
            providerAccountId: igBusinessId,
          },
        },
        create: {
          userId,
          platform: "instagram",
          providerAccountId: igBusinessId,
          displayName: igUsername || "Instagram Business",
          accessToken: pageAccessToken, // Page token works for IG publishing
          tokenExpiresAt: null,
          refreshToken: null,
          metaJson: {
            businessId,
            pageId,
            igBusinessId,
            username: igUsername,
            detectedAt: new Date().toISOString(),
          },
        },
        update: {
          displayName: igUsername || "Instagram Business",
          accessToken: pageAccessToken,
          metaJson: {
            businessId,
            pageId,
            igBusinessId,
            username: igUsername,
            detectedAt: new Date().toISOString(),
          },
        },
      });

      await prisma.socialPostingDestination.upsert({
        where: { userId_platform: { userId, platform: "instagram" } },
        create: {
          userId,
          platform: "instagram",
          selectedAccountId: igBusinessId,
          selectedDisplayName: igUsername || "Instagram Business",
        },
        update: {
          selectedAccountId: igBusinessId,
          selectedDisplayName: igUsername || "Instagram Business",
        },
      });
    } else {
      // Remove any existing IG connection for this business (best-effort; business-scoped)
      await prisma.socialAccountConnection.deleteMany({
        where: {
          userId,
          platform: "instagram",
          metaJson: { path: ["businessId"], equals: businessId },
        },
      });
    }

    return NextResponse.json({
      ok: true,
      page: { pageId, name: match.name },
      instagram: {
        connected: !!igBusinessId,
        igBusinessId,
        username: igUsername,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "UNKNOWN", message: err instanceof Error ? err.message : "Unknown error" } },
      { status: 500 }
    );
  }
}

