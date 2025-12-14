import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const now = new Date();
    const deleted = await prisma.proReport.deleteMany({
      where: {
        expiresAt: { lt: now }
      }
    });

    return NextResponse.json({
      ok: true,
      deletedCount: deleted.count,
    });
  } catch (err) {
    console.error("[GBP_PRO_CLEANUP]", err);
    return NextResponse.json(
      { ok: false, error: "Cleanup failed." },
      { status: 500 }
    );
  }
}
