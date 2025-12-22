import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const connectionString = process.env.DATABASE_URL || "";
  const hasSslmode = connectionString.includes("sslmode=");
  const hasConnectionLimit = connectionString.includes("connection_limit=");
  
  console.log("[Test DB] === Database Connectivity Test ===");
  console.log("[Test DB] Safe env checks:", {
    hasDatabaseUrl,
    hasSslmode,
    hasConnectionLimit,
  });

  try {
    // Read test
    console.log("[Test DB] Testing VerificationToken read...");
    await prisma.verificationToken.findFirst();
    console.log("[Test DB] ✓ Read successful");

    // Write test (create + delete)
    console.log("[Test DB] Testing VerificationToken create + delete...");
    const token = await prisma.verificationToken.create({
      data: {
        identifier: "test-db@local",
        token: "test-token",
        expires: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    console.log("[Test DB] ✓ Create successful");
    
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: token.identifier,
          token: token.token,
        },
      },
    });
    console.log("[Test DB] ✓ Delete successful");

    console.log("[Test DB] All tests passed - database is fully functional");

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Test DB] Database test failed:", {
      message: err?.message,
      code: err?.code,
      name: err?.name,
      stack: err?.stack,
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
        hasSslmode,
        hasConnectionLimit,
      },
      { status: 500 }
    );
  } finally {
    // Disconnect Prisma to avoid connection pool issues
    await prisma.$disconnect();
  }
}

