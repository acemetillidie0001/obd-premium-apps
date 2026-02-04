import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { mapMetaApiErrorToStableCode } from "@/lib/apps/social-auto-poster/metaErrorMapper";

/**
 * GET /api/social-connections/meta/pages
 *
 * Lists Facebook Pages the connected user can manage.
 * Manual-only. No background behavior.
 */
export async function GET() {
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

    const fbConnection = await prisma.socialAccountConnection.findFirst({
      where: {
        userId,
        platform: "facebook",
        metaJson: { path: ["businessId"], equals: businessId },
      },
    });

    if (!fbConnection?.accessToken) {
      return NextResponse.json({ ok: true, pages: [] as Array<{ pageId: string; name: string; canPublish: boolean }> });
    }

    if (fbConnection.tokenExpiresAt && fbConnection.tokenExpiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { ok: false, error: { code: "TOKEN_EXPIRED", message: "Token expired. Please reconnect." } },
        { status: 401 }
      );
    }

    const url =
      "https://graph.facebook.com/v21.0/me/accounts" +
      `?fields=${encodeURIComponent("id,name,tasks,access_token")}` +
      `&access_token=${encodeURIComponent(fbConnection.accessToken)}`;

    const resp = await fetch(url, { method: "GET" });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const metaErr = (data as any)?.error || {};
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

    const pagesRaw: Array<{ id?: string; name?: string; tasks?: string[] }> = Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];

    const pages = pagesRaw
      .filter((p) => typeof p.id === "string" && typeof p.name === "string")
      .map((p) => {
        const tasks = Array.isArray(p.tasks) ? p.tasks : [];
        const canPublish = tasks.includes("CREATE_CONTENT") || tasks.includes("MANAGE");
        return { pageId: p.id as string, name: p.name as string, canPublish };
      })
      .filter((p) => p.canPublish);

    return NextResponse.json({ ok: true, pages });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "UNKNOWN", message: err instanceof Error ? err.message : "Unknown error" } },
      { status: 500 }
    );
  }
}

