import { NextResponse } from "next/server";
import OpenAI from "openai";
import { TenantSafetyError } from "@/lib/integrations/anythingllm/scoping";

/**
 * Scheduler Event Logging
 * 
 * Logs non-PII events for Scheduler observability.
 * Only logs tags, route paths, and hashed business IDs (no names, emails, phones, or request bodies).
 */

/**
 * Hash a business ID for logging (non-reversible, consistent)
 */
function hashBusinessId(businessId: string | null | undefined): string | null {
  if (!businessId) return null;
  
  try {
    // Simple hash function (non-cryptographic, just for obfuscation)
    let hash = 0;
    for (let i = 0; i < businessId.length; i++) {
      const char = businessId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  } catch {
    return null;
  }
}

/**
 * Log a Scheduler event (non-PII only)
 * 
 * @param tag - Event tag (e.g., "DB_UNAVAILABLE", "INVALID_BOOKING_KEY")
 * @param meta - Optional metadata (route, hashed businessId, etc.) - NO PII
 */
export function logSchedulerEvent(
  tag: string,
  meta?: Record<string, string | null | undefined>
): void {
  try {
    const logData: Record<string, string | null> = {
      tag,
      ...(meta || {}),
    };

    // Remove undefined values
    Object.keys(logData).forEach((key) => {
      if (logData[key] === undefined) {
        delete logData[key];
      }
    });

    console.log("[Scheduler Event]", JSON.stringify(logData));
  } catch (error) {
    // Silently fail logging to avoid affecting request flow
    console.warn("[Scheduler Event] Logging failed:", error);
  }
}

/**
 * Log a Scheduler event with businessId hashing
 */
export function logSchedulerEventWithBusiness(
  tag: string,
  businessId: string | null | undefined,
  meta?: Record<string, string | null | undefined>
): void {
  const hashedBusinessId = hashBusinessId(businessId);
  logSchedulerEvent(tag, {
    ...meta,
    businessIdHash: hashedBusinessId,
  });
}

/**
 * Standardized API Error Handler
 * 
 * Provides consistent error response format across all API routes.
 * Ensures no stack traces leak to clients and all errors return the standard shape:
 * - Success: { ok: true, data: ... }
 * - Failure: { ok: false, error: string, code: string, ...optional details }
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "PREMIUM_REQUIRED"
  | "RATE_LIMITED"
  | "OPENAI_ERROR"
  | "OPENAI_TIMEOUT"
  | "TIMEOUT"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_NOT_FOUND"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INSTANT_BOOKING_DISABLED"
  | "SLOT_UNAVAILABLE"
  | "INVALID_SERVICE"
  | "BUSINESS_REQUIRED"
  | "MAPPING_REQUIRED"
  | "TENANT_SAFETY_BLOCKED"
  | "DATABASE_ERROR"
  | "DATABASE_CONNECTION_ERROR"
  | "DATABASE_MODEL_ERROR"
  | "PRISMA_CLIENT_OUTDATED"
  | "DB_UNAVAILABLE"
  | "PILOT_ONLY"
  | "INTERNAL_ERROR"
  | "OAUTH_ERROR"
  | "NOT_ENABLED"
  | "UNKNOWN_ERROR";

export interface ApiErrorResponse {
  ok: false;
  error: string;
  code: ApiErrorCode;
  details?: unknown;
}

export interface ApiSuccessResponse<T = unknown> {
  ok: true;
  data: T;
}

/**
 * Create a standardized error response
 */
export function apiErrorResponse(
  error: string,
  code: ApiErrorCode,
  status: number,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      ok: false,
      error,
      code,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

/**
 * Create a standardized success response
 */
export function apiSuccessResponse<T>(
  data: T,
  status = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    { status }
  );
}

/**
 * Handle errors from API route handlers
 * 
 * Converts known error types into consistent JSON responses.
 * Never leaks stack traces to clients.
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  const isDev = process.env.NODE_ENV === "development";

  // Log full error details server-side (never sent to client)
  console.error("[API Error Handler]", error);

  // Handle TenantSafetyError from scoping utilities (check first, before generic Error)
  if (error instanceof TenantSafetyError) {
    return apiErrorResponse(
      error.message,
      "TENANT_SAFETY_BLOCKED",
      400
    );
  }

  // Handle business/mapping requirement errors (check Error instances before OpenAI errors)
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    // Check for missing DATABASE_URL (DB_UNAVAILABLE)
    if (errorMessage.includes("database_url is not set")) {
      logSchedulerEvent("DB_UNAVAILABLE");
      return apiErrorResponse(
        "Scheduler is temporarily unavailable. Please try again soon.",
        "DB_UNAVAILABLE",
        503
      );
    }
    
    if (errorMessage.includes("business id is required") || errorMessage.includes("businessid is required")) {
      return apiErrorResponse(
        "Business ID is required",
        "BUSINESS_REQUIRED",
        400
      );
    }
    
    if (errorMessage.includes("no workspace mapping found") || 
        (errorMessage.includes("mapping") && errorMessage.includes("required"))) {
      return apiErrorResponse(
        "Workspace mapping is required. Please create a mapping in the database or use the setup wizard.",
        "MAPPING_REQUIRED",
        404
      );
    }
  }

  // OpenAI API errors
  if (error instanceof OpenAI.APIError) {
    // Handle timeout specifically
    if (error.code === "timeout" || error.message?.toLowerCase().includes("timeout")) {
      return apiErrorResponse(
        "Upstream timeout",
        "OPENAI_TIMEOUT",
        504
      );
    }

    // Handle other OpenAI errors
    return apiErrorResponse(
      "OpenAI API error",
      "OPENAI_ERROR",
      502,
      isDev ? {
        message: error.message,
        code: error.code,
        status: error.status,
      } : undefined
    );
  }

  // AbortError (timeout from AbortController)
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.includes("aborted"))
  ) {
    return apiErrorResponse(
      "Upstream timeout",
      "OPENAI_TIMEOUT",
      504
    );
  }

  // Generic Error instances
  if (error instanceof Error) {
    const errCode = (error as { code?: string }).code;
    const errorMessage = error.message.toLowerCase();
    
    if (errCode === "ECONNABORTED" || errCode === "ETIMEDOUT") {
      return apiErrorResponse(
        "Upstream timeout",
        "OPENAI_TIMEOUT",
        504
      );
    }

    // Handle UPSTREAM_NOT_FOUND errors (from AnythingLLM client)
    if (errCode === "UPSTREAM_NOT_FOUND") {
      const errDetails = (error as { details?: unknown }).details;
      return apiErrorResponse(
        error.message || "Upstream service not found",
        "UPSTREAM_NOT_FOUND",
        404,
        errDetails
      );
    }

    // Handle Prisma/Database errors (check before generic error handling)
    // Prisma errors often have specific patterns in their messages
    const isPrismaError =
      errorMessage.includes("prisma") ||
      errorMessage.includes("cannot read properties") ||
      (errorMessage.includes("undefined") &&
        (errorMessage.includes("findmany") ||
          errorMessage.includes("count") ||
          errorMessage.includes("create") ||
          errorMessage.includes("update") ||
          errorMessage.includes("delete"))) ||
      errorMessage.includes("database") ||
      errorMessage.includes("relation") ||
      (errorMessage.includes("connection") &&
        (errorMessage.includes("refused") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("failed"))) ||
      errorMessage.includes("p1001") || // Prisma connection error code
      errorMessage.includes("p2002") || // Prisma unique constraint error code
      errorMessage.includes("p2025"); // Prisma record not found error code

    if (isPrismaError) {
      // Detect specific Prisma error types
      let devMessage = "";
      let errorCode: ApiErrorCode = "DATABASE_ERROR";

      if (
        errorMessage.includes("cannot read properties") ||
        (errorMessage.includes("undefined") &&
          (errorMessage.includes("findmany") ||
            errorMessage.includes("count") ||
            errorMessage.includes("create") ||
            errorMessage.includes("update") ||
            errorMessage.includes("delete"))) ||
        errorMessage.includes("is not a function")
      ) {
        // Model missing (e.g., prisma.crmContact is undefined)
        errorCode = "DATABASE_MODEL_ERROR";
        devMessage =
          "Prisma client or model not available. Run 'npx prisma generate' and restart the dev server.";
      } else if (
        errorMessage.includes("connection") ||
        errorMessage.includes("connect econnrefused") ||
        errorMessage.includes("connection timeout") ||
        errorMessage.includes("can't reach database") ||
        errorMessage.includes("p1001")
      ) {
        // Connection failure
        errorCode = "DATABASE_CONNECTION_ERROR";
        devMessage =
          "Database connection failed. Check DATABASE_URL and ensure the database is running.";
      } else if (
        errorMessage.includes("relation") ||
        errorMessage.includes("does not exist") ||
        errorMessage.includes("p2025")
      ) {
        // Table/relation missing or record not found
        errorCode = "DATABASE_ERROR";
        devMessage =
          "Database table missing or record not found. Run 'npx prisma migrate deploy' to apply migrations.";
      } else {
        // Generic database error
        errorCode = "DATABASE_ERROR";
        devMessage = "Database error occurred.";
      }

      return apiErrorResponse(
        isDev ? devMessage : "Database error",
        errorCode,
        500,
        isDev
          ? {
              message: error.message,
            }
          : undefined
      );
    }
  }

  // Unknown errors - generic message, no stack traces
  return apiErrorResponse(
    "An unexpected error occurred",
    "UNKNOWN_ERROR",
    500,
    isDev
      ? {
          message: error instanceof Error ? error.message : String(error),
        }
      : undefined
  );
}

