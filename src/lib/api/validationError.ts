import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Validation Error Utility
 * 
 * Provides consistent validation error responses for API routes.
 * 
 * Usage:
 * ```typescript
 * const result = schema.safeParse(data);
 * if (!result.success) {
 *   return validationErrorResponse(result.error);
 * }
 * ```
 */

/**
 * Create a standardized validation error response
 * 
 * @param error - Zod validation error
 * @returns NextResponse with 400 status and consistent error format
 */
export function validationErrorResponse(error: ZodError): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: "Invalid input",
      code: "VALIDATION_ERROR",
      details: error.issues.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      })),
    },
    { status: 400 }
  );
}

