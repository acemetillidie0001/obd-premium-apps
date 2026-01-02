import { NextResponse } from "next/server";
import { ZodError, type ZodIssue } from "zod";

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
 * P2-8: Map Zod error messages to user-friendly messages
 * 
 * @param issue - Zod validation issue
 * @returns User-friendly error message
 */
function mapZodErrorToFriendlyMessage(issue: ZodIssue): string {
  const pathLast = issue.path[issue.path.length - 1];
  const fieldName = typeof pathLast === "string" || typeof pathLast === "number"
    ? String(pathLast)
    : "";
  const fieldDisplayName = fieldName
    ? fieldName
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
    : "Field";

  // Map common Zod error codes to friendly messages
  // Use string comparison to handle Zod's discriminated union type
  const code = issue.code as string;
  
  if (code === "invalid_type") {
    if (issue.message.includes("email")) {
      return `${fieldDisplayName} must be a valid email address`;
    }
    if (issue.message.includes("datetime")) {
      return `${fieldDisplayName} must be a valid date and time`;
    }
    return `${fieldDisplayName} has an invalid format`;
  }
  
  if (code === "invalid_string") {
    if (issue.message.includes("email")) {
      return `${fieldDisplayName} must be a valid email address`;
    }
    if (issue.message.includes("datetime")) {
      return `${fieldDisplayName} must be a valid date and time`;
    }
    return issue.message;
  }
  
  if (code === "too_small") {
    if (fieldName === "customerName") {
      return "Customer name is required";
    }
    if (fieldName === "customerEmail") {
      return "Email is required";
    }
    return `${fieldDisplayName} is too short`;
  }
  
  if (code === "too_big") {
    if (fieldName === "customerName") {
      return "Customer name cannot exceed 200 characters";
    }
    if (fieldName === "message") {
      return "Message cannot exceed 2000 characters";
    }
    if (fieldName === "customerPhone") {
      return "Phone number is too long";
    }
    return `${fieldDisplayName} is too long`;
  }
  
  if (code === "invalid_enum_value") {
    return `${fieldDisplayName} has an invalid value`;
  }
  
  if (code === "custom") {
    // For custom refine() errors, use the message as-is if it's user-friendly
    return issue.message;
  }
  
  // For unknown error types, try to make the message more user-friendly
  if (issue.message.includes("required")) {
    return `${fieldDisplayName} is required`;
  }
  if (issue.message.includes("Invalid")) {
    return `${fieldDisplayName} is invalid`;
  }
  // Fallback: return original message but with better field name
  return issue.message.replace(new RegExp(`^${fieldName}`, "i"), fieldDisplayName);
}

/**
 * Create a standardized validation error response with user-friendly messages (P2-8, P2-9)
 * 
 * @param error - Zod validation error
 * @returns NextResponse with 400 status and consistent error format
 */
export function validationErrorResponse(error: ZodError): NextResponse {
  const friendlyDetails = error.issues.map((issue) => ({
    field: issue.path.filter(p => typeof p === "string" || typeof p === "number").map(String).join("."),
    message: mapZodErrorToFriendlyMessage(issue),
  }));

  return NextResponse.json(
    {
      ok: false,
      error: "Please check the form fields and try again.",
      code: "VALIDATION_ERROR",
      details: friendlyDetails,
    },
    { status: 400 }
  );
}

