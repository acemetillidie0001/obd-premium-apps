import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { resolveBusinessIdServer } from "@/lib/utils/resolve-business-id.server";
import { isDemoRequest } from "@/lib/demo/assert-not-demo";
import crypto from "crypto";
import type { SeoAuditReportStatus } from "@prisma/client";

const DEFAULT_TTL_DAYS = 7;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function makeToken(): string {
  // 256-bit token, URL-safe
  return crypto.randomBytes(32).toString("base64url");
}

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

  // Resolve active audit (latest COMPLETED)
  const active = await prisma.seoAuditReport.findFirst({
    where: {
      businessId,
      status: "COMPLETED" as SeoAuditReportStatus,
    },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!active) {
    return NextResponse.json(
      { ok: false, error: { message: "No completed audit found to share." } },
      { status: 400 }
    );
  }

  const now = new Date();
  const expiresAt = addDays(now, DEFAULT_TTL_DAYS);

  // Revoke any active share tokens for this audit (single-link semantics)
  await prisma.seoAuditShareToken.updateMany({
    where: {
      businessId,
      auditReportId: active.id,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: { revokedAt: now },
  });

  // Create token (retry on collision)
  let tokenRow: { token: string; expiresAt: Date; id: string } | null = null;
  for (let i = 0; i < 5; i++) {
    const token = makeToken();
    try {
      tokenRow = await prisma.seoAuditShareToken.create({
        data: {
          businessId,
          auditReportId: active.id,
          token,
          expiresAt,
        },
        select: { id: true, token: true, expiresAt: true },
      });
      break;
    } catch (e: any) {
      // Unique collision: try again; otherwise surface error
      const msg = typeof e?.message === "string" ? e.message : "";
      if (msg.includes("Unique constraint") || msg.includes("unique")) continue;
      throw e;
    }
  }

  if (!tokenRow) {
    return NextResponse.json(
      { ok: false, error: { message: "Failed to create share token. Please try again." } },
      { status: 500 }
    );
  }

  const sharePath = `/share/seo-audit/${tokenRow.token}`;

  return NextResponse.json({
    ok: true,
    data: {
      sharePath,
      expiresAt: tokenRow.expiresAt.toISOString(),
      auditReportId: active.id,
      tokenId: tokenRow.id,
    },
  });
}


