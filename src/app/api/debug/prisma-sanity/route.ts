/**
 * Prisma Sanity Check Debug Endpoint
 * 
 * Dev-only endpoint to verify Prisma models are available at runtime.
 * Useful for debugging stale Prisma client issues after migrations.
 * 
 * Returns 404 in production.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Production guard
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  try {
    // Check if prisma client exists
    if (!prisma) {
      return NextResponse.json(
        {
          ok: false,
          error: "Prisma client is null or undefined",
          code: "PRISMA_MISSING",
        },
        { status: 500 }
      );
    }

    // Check model availability using typeof checks
    const hasUser = typeof prisma.user?.findMany === "function";
    const hasCrmContact = typeof prisma.crmContact?.findMany === "function";
    const hasCrmTag = typeof prisma.crmTag?.findMany === "function";

    // Optional: Try lightweight count() calls to verify models actually work
    let userCount: number | null = null;
    let crmContactCount: number | null = null;
    let crmTagCount: number | null = null;

    if (hasUser) {
      try {
        userCount = await prisma.user.count();
      } catch (err) {
        // Model exists but query failed
        console.warn("[Prisma Sanity] User model exists but count() failed:", err);
      }
    }

    if (hasCrmContact) {
      try {
        crmContactCount = await prisma.crmContact.count();
      } catch (err) {
        console.warn("[Prisma Sanity] CrmContact model exists but count() failed:", err);
      }
    }

    if (hasCrmTag) {
      try {
        crmTagCount = await prisma.crmTag.count();
      } catch (err) {
        console.warn("[Prisma Sanity] CrmTag model exists but count() failed:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        hasUser,
        hasCrmContact,
        hasCrmTag,
        // Include counts if available (useful for debugging)
        counts: {
          user: userCount,
          crmContact: crmContactCount,
          crmTag: crmTagCount,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Prisma Sanity] Unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        code: "UNEXPECTED_ERROR",
      },
      { status: 500 }
    );
  }
}

