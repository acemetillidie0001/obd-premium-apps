import { NextRequest, NextResponse } from "next/server";
import { getProReportByShareId } from "../../reportStore";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid report ID." },
        { status: 400 }
      );
    }

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
      // Delete expired report (idempotent - safe if already deleted)
      try {
        await prisma.proReport.delete({ where: { shareId: id } });
      } catch (deleteError) {
        // Ignore deletion errors (report may already be deleted)
        console.error("[GBP_PRO_REPORT] Error deleting expired report:", deleteError);
      }

      return NextResponse.json(
        { error: "This report has expired." },
        { status: 410 }
      );
    }

    // Check token if report has one
    if (report.accessToken) {
      const token = req.nextUrl.searchParams.get("token");
      if (!token || token !== report.accessToken) {
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
  } catch (error) {
    console.error("[GBP_PRO_REPORT] Error fetching report:", error);
    return NextResponse.json(
      { error: "Failed to retrieve report." },
      { status: 500 }
    );
  }
}
