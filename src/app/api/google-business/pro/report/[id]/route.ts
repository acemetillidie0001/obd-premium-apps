import { NextRequest, NextResponse } from "next/server";
import { getProReportByShareId } from "../../reportStore";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = await getProReportByShareId(id);

  if (!report) {
    return NextResponse.json(
      { error: "Report not found" },
      { status: 404 }
    );
  }

  // Check if report has expired
  const now = new Date();
  if (report.expiresAt && report.expiresAt < now) {
    // optionally delete it right now
    try {
      await prisma.proReport.delete({ where: { shareId: id } });
    } catch {}

    return NextResponse.json(
      { error: "This report has expired." },
      { status: 410 }
    );
  }

  // Check token if report has one
  if (report.accessToken) {
    const token = req.nextUrl.searchParams.get("token");
    if (token !== report.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized — invalid or missing report access token." },
        { status: 401 }
      );
    }
  }

  return NextResponse.json({
    html: report.html,
    pdfBase64: report.pdfBase64 ?? null,
    meta: {
      businessName: report.businessName,
      city: report.city,
      state: report.state,
      score: report.score,
      createdAt: report.createdAt.toISOString(),
      accessToken: report.accessToken ?? undefined,
    },
  });
}
