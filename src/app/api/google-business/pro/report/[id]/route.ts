import { NextRequest, NextResponse } from "next/server";
import { REPORT_STORE } from "../reportStore";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const stored = REPORT_STORE.get(id);

  if (!stored) {
    return NextResponse.json(
      { error: "Report not found" },
      { status: 404 }
    );
  }

  // Check token if report has one
  if (stored.meta.accessToken) {
    const token = req.nextUrl.searchParams.get("token");
    if (token !== stored.meta.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized — invalid or missing report access token." },
        { status: 401 }
      );
    }
  }

  return NextResponse.json({
    html: stored.html,
    pdfBase64: stored.pdfBase64 ?? null,
    meta: stored.meta,
  });
}
