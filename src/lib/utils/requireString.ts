/**
 * Ensures a required string value is present.
 * Fails fast with a clear error message and enables
 * TypeScript type narrowing (string, not string | null).
 */
export function requireString(
  value: string | null | undefined,
  fieldName: string,
  context?: string
): string {
  if (!value || typeof value !== "string" || value.trim() === "") {
    const prefix = context ? `[${context}] ` : "";
    throw new Error(`${prefix}Missing required field: ${fieldName}`);
  }

  return value;
}

