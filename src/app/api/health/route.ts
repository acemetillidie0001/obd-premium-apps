import { NextResponse } from "next/server";

/**
 * GET /api/health
 * 
 * Dev-only health endpoint for readiness checks.
 * Returns 404 in production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
  });
}

