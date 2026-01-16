import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { resolveBusinessIdServer } from "@/lib/utils/resolve-business-id.server";
import { isDemoRequest } from "@/lib/demo/assert-not-demo";
import type { SeoAuditReportStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: { message: "Authentication required." } },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();
  const resolvedBusinessId = await resolveBusinessIdServer(
    cookieStore,
    request.nextUrl?.searchParams ?? null
  );
  const businessId = resolvedBusinessId ?? session.user.id;

  // Tenant safety: never allow URL businessId to access other tenants.
  if (!isDemoRequest(request) && businessId !== session.user.id) {
    return NextResponse.json(
      { ok: false, error: { message: "Tenant mismatch. Invalid business context." } },
      { status: 403 }
    );
  }

  const json = await request.json().catch(() => null);
  const tokenId = typeof json?.tokenId === "string" ? json.tokenId : null;

  // Allow revoking a specific tokenId (preferred), otherwise revoke active token(s) for current active audit.
  const now = new Date();

  if (tokenId) {
    const tokenRow = await prisma.seoAuditShareToken.findFirst({
      where: { id: tokenId, businessId },
      select: { id: true },
    });
    if (!tokenRow) {
      return NextResponse.json(
        { ok: false, error: { message: "Share token not found." } },
        { status: 404 }
      );
    }

    await prisma.seoAuditShareToken.updateMany({
      where: { id: tokenId, businessId, revokedAt: null },
      data: { revokedAt: now },
    });

    return NextResponse.json({ ok: true });
  }

  const active = await prisma.seoAuditReport.findFirst({
    where: { businessId, status: "COMPLETED" as SeoAuditReportStatus },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  if (!active) {
    return NextResponse.json(
      { ok: false, error: { message: "No completed audit found." } },
      { status: 400 }
    );
  }

  await prisma.seoAuditShareToken.updateMany({
    where: {
      businessId,
      auditReportId: active.id,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: { revokedAt: now },
  });

  return NextResponse.json({ ok: true });
}


