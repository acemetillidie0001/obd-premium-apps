/**
 * Demo Mode Constants
 * 
 * Centralized configuration for Demo Mode functionality.
 * Handles environment variable access with validation and defaults.
 */

/**
 * Time-to-live for demo mode cookie in minutes.
 * 
 * Default: 60 minutes (1 hour)
 * Can be overridden via DEMO_TTL_MINUTES environment variable.
 */
export const DEMO_TTL_MINUTES: number = (() => {
  const envValue = process.env.DEMO_TTL_MINUTES;
  
  // If not set, use default of 60 minutes
  if (!envValue) {
    return 60;
  }
  
  // Parse and validate the value
  const parsed = Number.parseInt(envValue, 10);
  
  // Validate: must be a positive integer
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(
      `[Demo Mode] Invalid DEMO_TTL_MINUTES value: "${envValue}". Using default: 60 minutes.`
    );
    return 60;
  }
  
  return parsed;
})();

/**
 * Requires DEMO_BUSINESS_ID environment variable to be set.
 * 
 * Throws a helpful error message if the variable is missing or empty.
 * 
 * @returns The demo business ID string
 * @throws Error if DEMO_BUSINESS_ID is not set or empty
 * 
 * @example
 * ```typescript
 * const demoBusinessId = requireDemoBusinessId();
 * // Use demoBusinessId for demo mode operations
 * ```
 */
export function requireDemoBusinessId(): string {
  const demoBusinessId = process.env.DEMO_BUSINESS_ID;
  
  // Check if variable is set and non-empty
  if (!demoBusinessId || demoBusinessId.trim().length === 0) {
    throw new Error(
      `DEMO_BUSINESS_ID environment variable is required for Demo Mode.\n\n` +
      `Please set DEMO_BUSINESS_ID in:\n` +
      `  - .env.local (for local development)\n` +
      `  - Vercel Project Settings → Environment Variables (for production)\n\n` +
      `The value should be a valid business ID from your database.`
    );
  }
  
  return demoBusinessId.trim();
}

