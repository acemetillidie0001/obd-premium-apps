/**
 * Business ID Resolver Utility
 * 
 * Resolves businessId from multiple sources with a fallback chain:
 * 1. URL search params (businessId query param)
 * 2. Future: Session/user object (when available)
 * 3. Future: Business context provider (when available)
 * 
 * Returns null if no businessId can be resolved.
 */

/**
 * Resolves businessId from available sources
 * 
 * @param searchParams - Next.js search params from useSearchParams()
 * @returns businessId string or null if not found
 */
export function resolveBusinessId(searchParams: URLSearchParams | null): string | null {
  // Priority 1: URL search params (current method, works for dashboard links)
  if (searchParams) {
    const businessIdFromUrl = searchParams.get("businessId");
    if (businessIdFromUrl && businessIdFromUrl.trim().length > 0) {
      return businessIdFromUrl.trim();
    }
  }

  // Priority 2: Future - Session/user object
  // TODO: When session access is available client-side, check session.user.id
  // In V3, user.id appears to be the businessId in some contexts

  // Priority 3: Future - Business context provider
  // TODO: When a global business context is implemented, check it here

  return null;
}

