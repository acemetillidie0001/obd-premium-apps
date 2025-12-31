/**
 * Database Error Handler for CRM Routes
 * 
 * Provides friendly error messages for common database issues.
 */

import { NextResponse } from "next/server";
import type { ApiErrorResponse, ApiErrorCode } from "@/lib/api/errorHandler";

/**
 * Checks if an error is related to missing DATABASE_URL
 */
function isDatabaseUrlMissingError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("DATABASE_URL is not set");
  }
  return false;
}

/**
 * Checks if an error is related to missing database tables
 */
function isTableMissingError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Prisma error code P2021 = table does not exist
    // Also check for common error messages
    return (
      message.includes("p2021") ||
      message.includes("does not exist") ||
      message.includes("relation") && message.includes("does not exist") ||
      message.includes("table") && message.includes("missing")
    );
  }
  return false;
}

/**
 * Handles database-related errors and returns friendly API responses
 * 
 * @param error The caught error
 * @returns NextResponse with friendly error message, or null if not a handled error
 */
export function handleCrmDatabaseError(error: unknown): NextResponse<ApiErrorResponse> | null {
  if (isDatabaseUrlMissingError(error)) {
    return NextResponse.json<ApiErrorResponse>(
      {
        ok: false,
        error: "DATABASE_URL is not set. Add it to .env.local and restart the dev server.",
        code: "DATABASE_CONNECTION_ERROR" as ApiErrorCode,
      },
      { status: 500 }
    );
  }

  if (isTableMissingError(error)) {
    return NextResponse.json<ApiErrorResponse>(
      {
        ok: false,
        error: "CRM database tables are missing. Run: pnpm run migrate:deploy",
        code: "DATABASE_ERROR" as ApiErrorCode,
      },
      { status: 500 }
    );
  }

  // Not a handled error, return null to let caller handle it
  return null;
}

