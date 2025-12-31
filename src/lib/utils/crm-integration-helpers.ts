/**
 * CRM Integration Helpers
 * 
 * Shared utilities for CRM integration across apps:
 * - returnUrl validation
 * - Consistent styling for CRM context indicators
 */

/**
 * Validate returnUrl (only allow internal relative paths starting with "/apps/")
 * This prevents open redirect vulnerabilities.
 */
export function isValidReturnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    // Must be a relative path starting with "/apps/"
    if (!url.startsWith("/apps/")) return false;
    // Must not contain protocol or host
    if (url.includes("://") || url.includes("//")) return false;
    // Must not contain dangerous characters
    if (url.includes("<") || url.includes(">") || url.includes('"') || url.includes("'")) return false;
    return true;
  } catch {
    return false;
  }
}

