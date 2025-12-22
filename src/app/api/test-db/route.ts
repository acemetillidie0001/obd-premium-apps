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
    // Step 1: Test read access to VerificationToken table
    console.log("[Test DB] Step 1: Testing VerificationToken table read access...");
    const existingToken = await prisma.verificationToken.findFirst({
      take: 1,
    });
    console.log("[Test DB] Step 1: ✓ Read successful");

    // Step 2: Test write access (CREATE) with a safe test record
    console.log("[Test DB] Step 2: Testing VerificationToken table write access (CREATE)...");
    const testIdentifier = `test-${Date.now()}@test.local`;
    const testToken = `test-token-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const testExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await prisma.verificationToken.create({
      data: {
        identifier: testIdentifier,
        token: testToken,
        expires: testExpires,
      },
    });
    console.log("[Test DB] Step 2: ✓ CREATE successful");

    // Step 3: Test delete access (DELETE) - clean up test record
    console.log("[Test DB] Step 3: Testing VerificationToken table delete access (DELETE)...");
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: testIdentifier,
        token: testToken,
      },
    });
    console.log("[Test DB] Step 3: ✓ DELETE successful");

    console.log("[Test DB] All tests passed - database is fully functional");

    return NextResponse.json({
      ok: true,
      message: "Database connection and schema operations successful",
      tests: {
        read: true,
        create: true,
        delete: true,
      },
      hasDatabaseUrl,
      hasSslmode,
      hasConnectionLimit,
    });
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

