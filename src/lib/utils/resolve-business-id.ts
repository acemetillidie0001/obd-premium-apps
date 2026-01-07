/**
 * Business ID Resolver Utility
 * 
 * Resolves businessId from multiple sources with a fallback chain:
 * 0. CRITICAL: Demo mode cookie check (highest priority - tenant safety)
 * 1. URL search params (businessId query param)
 * 2. Future: Session/user object (when available)
 * 3. Future: Business context provider (when available)
 * 
 * Returns null if no businessId can be resolved.
 * 
 * TENANT SAFETY: Demo mode must NEVER access real tenants.
 * If the demo cookie is present, this function ALWAYS returns the demo business ID,
 * ignoring all other sources (URL params, session, etc.).
 */

// Demo cookie name - hardcoded to avoid importing server-only code in client components
// This matches the value in src/lib/demo/demo-cookie.ts
const DEMO_COOKIE = "obd_demo";

/**
 * Helper function to check if demo cookie exists in client-side context
 * @returns true if demo cookie is present
 */
function hasDemoCookieClient(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  
  const cookies = document.cookie.split(";");
  return cookies.some((cookie) => {
    const [name] = cookie.trim().split("=");
    return name === DEMO_COOKIE;
  });
}

/**
 * Gets the demo business ID (client-safe version)
 * 
 * CRITICAL TENANT SAFETY: For demo mode, we must return the demo business ID.
 * 
 * On the client side, we check NEXT_PUBLIC_DEMO_BUSINESS_ID first (which can be
 * safely exposed to the client), falling back to DEMO_BUSINESS_ID during build time.
 * 
 * If neither is available, we throw an error to prevent accidental access to real tenants.
 */
function getDemoBusinessIdClient(): string {
  // Try NEXT_PUBLIC_ version first (client-accessible)
  const demoBusinessId = 
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEMO_BUSINESS_ID) ||
    (typeof process !== "undefined" && process.env.DEMO_BUSINESS_ID);
  
  if (!demoBusinessId || demoBusinessId.trim().length === 0) {
    throw new Error(
      "Demo mode is active but DEMO_BUSINESS_ID is not accessible on the client. " +
      "Set NEXT_PUBLIC_DEMO_BUSINESS_ID for client-side demo mode support, or ensure " +
      "business ID resolution happens server-side using resolveBusinessIdServer()."
    );
  }
  
  return demoBusinessId.trim();
}

/**
 * Resolves businessId from available sources (CLIENT-SIDE VERSION)
 * 
 * CRITICAL TENANT SAFETY: If demo cookie is present, immediately returns demo business ID.
 * Demo mode must never access real tenants - this check happens FIRST, before any other resolution.
 * 
 * @param searchParams - Next.js search params from useSearchParams()
 * @returns businessId string or null if not found
 */
export function resolveBusinessId(searchParams: URLSearchParams | null): string | null {
  // PRIORITY 0: Demo mode check (CRITICAL - must happen first for tenant safety)
  // Demo mode must NEVER access real tenants; it always uses the demo businessId
  if (hasDemoCookieClient()) {
    return getDemoBusinessIdClient();
  }

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

// Server-side version is exported from resolve-business-id.server.ts
// Import it as: import { resolveBusinessIdServer } from "@/lib/utils/resolve-business-id.server";
// This separation ensures server-only code doesn't get bundled with client components

