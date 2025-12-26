/**
 * Get Base URL for OAuth Redirects
 * 
 * Returns the base URL to use for OAuth redirect URIs.
 * 
 * Priority:
 * 1. NEXTAUTH_URL (or AUTH_URL for NextAuth v5) - preferred for OAuth
 * 2. NEXT_PUBLIC_APP_URL - fallback
 * 3. request.nextUrl.origin - last resort (only when request is available)
 * 
 * This ensures:
 * - Production uses https://apps.ocalabusinessdirectory.com via env vars
 * - Local dev with ngrok uses the HTTPS ngrok URL via NEXTAUTH_URL
 * - No hardcoded localhost URLs
 */

export function getBaseUrl(requestOrigin?: string): string {
  // Prefer NEXTAUTH_URL (or AUTH_URL for NextAuth v5 compatibility)
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (authUrl) {
    return authUrl;
  }

  // Fallback to NEXT_PUBLIC_APP_URL
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (publicAppUrl) {
    return publicAppUrl;
  }

  // Last resort: use request origin (only available in callback handlers)
  if (requestOrigin) {
    return requestOrigin;
  }

  // If none are available, throw an error (should not happen in production)
  throw new Error(
    "Base URL not configured. Set NEXTAUTH_URL, AUTH_URL, or NEXT_PUBLIC_APP_URL environment variable."
  );
}

/**
 * Get Base URL for Meta OAuth Redirects (strict validation)
 * 
 * For Meta OAuth, NEXTAUTH_URL is the sole source of truth.
 * This function enforces:
 * - NEXTAUTH_URL must be set
 * - NEXTAUTH_URL must be HTTPS
 * - Returns normalized URL (no trailing slashes, no extra params)
 * 
 * @throws Error if NEXTAUTH_URL is missing or not HTTPS
 */
export function getMetaOAuthBaseUrl(): string {
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  
  if (!authUrl) {
    throw new Error(
      "NEXTAUTH_URL is required for Meta OAuth. Set NEXTAUTH_URL to your HTTPS URL (e.g., https://<subdomain>.ngrok-free.dev for local dev, or https://apps.ocalabusinessdirectory.com for production)."
    );
  }

  // Normalize the URL: remove trailing slashes, ensure it's a valid URL
  let normalizedUrl = authUrl.trim();
  
  // Remove trailing slash
  normalizedUrl = normalizedUrl.replace(/\/+$/, "");
  
  // Validate it's a valid URL
  let url: URL;
  try {
    url = new URL(normalizedUrl);
  } catch (error) {
    throw new Error(
      `NEXTAUTH_URL is not a valid URL: ${normalizedUrl}. Expected format: https://<domain>`
    );
  }

  // Enforce HTTPS for Meta OAuth (Meta requires HTTPS for redirect URIs)
  if (url.protocol !== "https:") {
    throw new Error(
      `NEXTAUTH_URL must use HTTPS for Meta OAuth. Current value: ${normalizedUrl}. For local development, use ngrok (https://<subdomain>.ngrok-free.dev).`
    );
  }

  // Return the normalized base URL (no trailing slash, no path, no query params, no hash)
  return `${url.protocol}//${url.host}`;
}

