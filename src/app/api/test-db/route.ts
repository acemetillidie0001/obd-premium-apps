import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  
  console.log("[Test DB] === Database Connectivity Test ===");
  console.log("[Test DB] DATABASE_URL present:", hasDatabaseUrl);

  try {
    // Test database connectivity with a simple query
    // Query VerificationToken table (used by NextAuth for magic links)
    const result = await prisma.verificationToken.findFirst({
      take: 1,
    });

    console.log("[Test DB] Query successful, database is connected");
    console.log("[Test DB] VerificationToken table accessible:", true);

    return NextResponse.json({
      ok: true,
      message: "Database connection successful",
      hasDatabaseUrl,
      tableAccessible: true,
    });
  } catch (err: any) {
    console.error("[Test DB] Database connection failed:", {
      message: err?.message,
      code: err?.code,
      name: err?.name,
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          message: err?.message || "Unknown database error",
          code: err?.code || "UNKNOWN",
          name: err?.name || "Error",
        },
        hasDatabaseUrl,
      },
      { status: 500 }
    );
  } finally {
    // Disconnect Prisma to avoid connection pool issues
    await prisma.$disconnect();
  }
}

