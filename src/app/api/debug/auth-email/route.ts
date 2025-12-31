import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

/**
 * Local-only debug endpoint to validate email + DB connectivity
 * 
 * Returns structured JSON with:
 * - env: Environment variable presence checks (no secrets exposed)
 * - db: Database connectivity test
 * - resend: Resend API key validation
 * 
 * NEVER returns secrets, connection strings, or API keys.
 */
export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Debug endpoint not available in production" },
      { status: 403 }
    );
  }

  const result: {
    ok: boolean;
    env: {
      hasDatabaseUrl: boolean;
      hasResendKey: boolean;
      emailFrom: string | null;
      nextauthUrl: string | null;
    };
    db: { ok: boolean; error?: string };
    resend: { ok: boolean; error?: string };
  } = {
    ok: true,
    env: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasResendKey: !!process.env.RESEND_API_KEY,
      emailFrom: process.env.EMAIL_FROM || null,
      nextauthUrl: process.env.NEXTAUTH_URL || process.env.AUTH_URL || null,
    },
    db: { ok: false },
    resend: { ok: false },
  };

  // Test database connectivity
  try {
    // Minimal Prisma query: count users (or any table)
    // Identity source: User model (NextAuth user table) - see prisma/schema.prisma
    await prisma.user.count();
    result.db.ok = true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Return safe error message (no connection strings)
    if (errorMessage.includes("DATABASE_URL") || errorMessage.includes("connection")) {
      result.db.error = "Database connection failed. Check DATABASE_URL.";
    } else if (errorMessage.includes("P1001") || errorMessage.includes("Can't reach")) {
      result.db.error = "Database unreachable. Check network and DATABASE_URL.";
    } else if (errorMessage.includes("P1000") || errorMessage.includes("authentication")) {
      result.db.error = "Database authentication failed. Check DATABASE_URL credentials.";
    } else {
      result.db.error = `Database error: ${errorMessage.substring(0, 100)}`;
    }
    result.ok = false;
  }

  // Test Resend API key
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      result.resend.error = "RESEND_API_KEY not set";
    } else if (!resendApiKey.startsWith("re_")) {
      result.resend.error = "RESEND_API_KEY format invalid (should start with 're_')";
    } else {
      // Instantiate Resend client (lightweight, doesn't make API call)
      const resend = new Resend(resendApiKey);
      // Resend client instantiation is lightweight - if it fails, the key format is wrong
      // We could do a lightweight API call here, but Resend doesn't have a simple "ping" endpoint
      // So we just validate the key format and client instantiation
      result.resend.ok = true;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.resend.error = `Resend validation failed: ${errorMessage.substring(0, 100)}`;
    result.ok = false;
  }

  return NextResponse.json(result);
}

