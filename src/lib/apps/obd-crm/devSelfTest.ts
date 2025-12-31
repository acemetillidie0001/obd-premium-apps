/**
 * Dev-only self-test helper for OBD CRM routes
 * 
 * Verifies database connectivity and required CRM tables exist.
 * Only runs in development mode - no performance impact in production.
 * 
 * Returns structured error responses instead of throwing exceptions.
 */

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/lib/api/errorHandler";

type SelfTestResult = {
  ok: true;
} | {
  ok: false;
  error: string;
  code: "DATABASE_CONNECTION_ERROR" | "DATABASE_MODEL_ERROR";
  guidance: string[];
}

/**
 * Run self-test verification for CRM routes
 * 
 * Checks:
 * 1. Database connectivity
 * 2. Required CRM models exist (crmContact, crmTag)
 * 
 * @returns SelfTestResult with ok: true if all checks pass, or error details if any fail
 */
export async function verifyCrmDatabaseSetup(): Promise<SelfTestResult> {
  // Only run in development
  if (process.env.NODE_ENV === "production") {
    return { ok: true };
  }

  // Check 1: Database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: "Database connection failed",
      code: "DATABASE_CONNECTION_ERROR",
      guidance: [
        "Check DATABASE_URL is set correctly in .env.local",
        "Ensure the database server is running",
        "Verify network connectivity to the database",
        "Run: npx prisma migrate deploy (if migrations are pending)",
      ],
    };
  }

  // Check 2: Required CRM models exist
  const missingModels: string[] = [];
  const requiredModels = [
    { name: "crmContact", displayName: "CrmContact" },
    { name: "crmTag", displayName: "CrmTag" },
  ];

  for (const model of requiredModels) {
    const modelInstance = (prisma as any)[model.name];
    if (!modelInstance || typeof modelInstance.findMany !== "function") {
      missingModels.push(model.displayName);
    }
  }

  if (missingModels.length > 0) {
    return {
      ok: false,
      error: `Missing required CRM models: ${missingModels.join(", ")}`,
      code: "DATABASE_MODEL_ERROR",
      guidance: [
        "Run: npx prisma generate (to regenerate Prisma client)",
        "Run: npx prisma migrate deploy (to apply database migrations)",
        "Restart the dev server after running the above commands",
        "Verify prisma/schema.prisma contains the CrmContact and CrmTag models",
      ],
    };
  }

  // All checks passed
  return { ok: true };
}

/**
 * Convert self-test result to API error response
 * 
 * Used by CRM routes to return structured errors when verification fails.
 * Never throws - always returns a NextResponse.
 */
export function selfTestErrorResponse(result: Extract<SelfTestResult, { ok: false }>): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: result.error,
      code: result.code,
      details: {
        guidance: result.guidance,
      },
    },
    { status: 500 }
  );
}

