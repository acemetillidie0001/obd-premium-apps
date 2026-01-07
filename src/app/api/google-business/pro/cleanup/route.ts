import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    const now = new Date();
    
    // Delete all reports where expiresAt is in the past
    // This is idempotent - safe to run multiple times
    const deleted = await prisma.proReport.deleteMany({
      where: {
        expiresAt: { 
          not: null, // Only delete reports that have an expiration date
          lt: now    // And are expired
        }
      }
    });

    return NextResponse.json({
      ok: true,
      deletedCount: deleted.count,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("[GBP_PRO_CLEANUP] Error during cleanup:", err);
    return NextResponse.json(
      { ok: false, error: "Cleanup failed." },
      { status: 500 }
    );
  }
}
