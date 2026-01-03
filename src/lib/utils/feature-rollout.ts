/**
 * Feature Rollout Utilities
 * 
 * Provides staged rollout logic for new features with allowlist support
 * and query parameter overrides for testing.
 */

interface IsBdwV4EnabledParams {
  masterEnabled: boolean;
  userEmail: string | null | undefined;
  searchParams: URLSearchParams | ReadonlyURLSearchParams | null;
}

/**
 * Determine if BDW V4 UI should be enabled for the current user.
 * 
 * Logic:
 * 1. If masterEnabled is false => return false
 * 2. If searchParams has bdwV4=0 => return false (force legacy)
 * 3. If searchParams has bdwV4=1 => return true (force V4 for testing)
 * 4. Otherwise => return true only if userEmail is in allowlist
 * 
 * @param masterEnabled - The master feature flag value (flags.bdwV4)
 * @param userEmail - The current user's email (from session, can be null/undefined)
 * @param searchParams - URL search params (from useSearchParams())
 * @returns true if V4 should be enabled, false otherwise
 */
export function isBdwV4Enabled({
  masterEnabled,
  userEmail,
  searchParams,
}: IsBdwV4EnabledParams): boolean {
  // Step 1: Master switch must be enabled
  if (!masterEnabled) {
    return false;
  }

  // Step 2: Check query param override (takes precedence)
  if (searchParams) {
    const bdwV4Param = searchParams.get("bdwV4");
    if (bdwV4Param === "0") {
      return false; // Force legacy UI
    }
    if (bdwV4Param === "1") {
      return true; // Force V4 UI (for testing)
    }
  }

  // Step 3: Check allowlist
  const allowlist = ["scottbaxtermarketing@gmail.com"];
  
  // If no user email, default to false (null-safe)
  if (!userEmail) {
    return false;
  }

  // Check if user email is in allowlist (case-insensitive)
  const normalizedEmail = userEmail.toLowerCase().trim();
  return allowlist.some((allowed) => allowed.toLowerCase().trim() === normalizedEmail);
}

