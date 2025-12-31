/**
 * Safe Database URL Requirer
 * 
 * Validates that DATABASE_URL is set and provides a clear error message
 * if it's missing. This ensures we fail fast with helpful guidance.
 */

/**
 * Requires DATABASE_URL to be set, throwing a friendly error if missing.
 * 
 * @returns The DATABASE_URL string if present
 * @throws Error with clear instructions if DATABASE_URL is missing
 */
export function requireDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl || dbUrl.trim() === "") {
    throw new Error(
      "DATABASE_URL is not set. Create .env.local in repo root and set DATABASE_URL=... then restart dev server."
    );
  }

  return dbUrl;
}

