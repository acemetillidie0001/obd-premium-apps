/**
 * Handoff URL Parameter Utilities
 * 
 * Provides utilities to clean handoff-related query parameters from URLs
 * while preserving all other parameters and hash fragments.
 */

/**
 * Clear handoff-related query parameters from a URL string
 * 
 * Removes ONLY "handoff", "handoffId", "mode", and "source" query parameters while preserving:
 * - All other query parameters
 * - Hash fragments (#...)
 * - URL path and protocol
 * 
 * @param url - The URL string to clean
 * @returns The cleaned URL string with handoff params removed
 * 
 * @example
 * // Input: "https://example.com/app?handoff=abc&other=123&handoffId=xyz&mode=web-draft#section"
 * // Output: "https://example.com/app?other=123#section"
 * 
 * @example
 * // Input: "/apps/content-writer?handoff=xyz&from=crm&source=ai-content-writer"
 * // Output: "/apps/content-writer?from=crm"
 * 
 * @example
 * // Input: "?handoff=abc"
 * // Output: "?" (empty query string) or "" (if no other params)
 */
export function clearHandoffParamsFromUrl(url: string): string {
  try {
    const urlObj = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    
    // Remove only known handoff-related params: handoffId, mode, source (and legacy handoff)
    urlObj.searchParams.delete("handoff");
    urlObj.searchParams.delete("handoffId");
    urlObj.searchParams.delete("mode");
    urlObj.searchParams.delete("source");
    
    // Reconstruct URL preserving hash
    const pathname = urlObj.pathname;
    const search = urlObj.search; // Includes "?" if params exist, empty string if not
    const hash = urlObj.hash; // Includes "#" if hash exists, empty string if not
    
    // Handle relative URLs (preserve original format)
    if (url.startsWith("/") || url.startsWith("?")) {
      // Relative URL - return pathname + search + hash
      return pathname + search + hash;
    }
    
    // Absolute URL - return full URL
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails (e.g., malformed URL), try simple string replacement
    // This is a fallback for edge cases
    console.warn("Failed to parse URL, using fallback:", error);
    
    // Simple regex-based fallback
    let cleaned = url;
    
    // Remove known handoff params (with or without value): handoff, handoffId, mode, source
    const paramsToRemove = ["handoff", "handoffId", "mode", "source"];
    for (const param of paramsToRemove) {
      cleaned = cleaned.replace(new RegExp(`[?&]${param}=[^&]*`, "g"), (match, offset) => {
        // If this is the first param (starts with ?), keep the ?
        return offset === 0 || cleaned[offset - 1] === "?" ? "?" : "";
      });
    }
    
    // Clean up double question marks or trailing ?/&
    cleaned = cleaned.replace(/\?&/g, "?").replace(/[?&]$/, "");
    
    return cleaned;
  }
}

/**
 * Replace the current URL without reloading the page
 * 
 * SSR-safe: Does nothing if window is undefined (server-side rendering)
 * Uses history.replaceState to update the URL without triggering navigation
 * 
 * @param cleanUrl - The cleaned URL string to navigate to
 * 
 * @example
 * // In a client component:
 * const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
 * replaceUrlWithoutReload(cleanUrl);
 */
export function replaceUrlWithoutReload(cleanUrl: string): void {
  if (typeof window === "undefined") {
    // SSR-safe: no-op on server
    return;
  }

  try {
    window.history.replaceState(null, "", cleanUrl);
  } catch (error) {
    // Fail-safe: silently handle any errors (e.g., invalid URL, security restrictions)
    console.warn("Failed to replace URL:", error);
  }
}

/**
 * Self-check examples (for manual verification):
 * 
 * clearHandoffParamsFromUrl("https://example.com/app?handoff=abc&other=123&handoffId=xyz&mode=web-draft#section")
 *   → "https://example.com/app?other=123#section"
 * 
 * clearHandoffParamsFromUrl("/apps/content-writer?handoff=xyz&from=crm&source=ai-content-writer")
 *   → "/apps/content-writer?from=crm"
 * 
 * clearHandoffParamsFromUrl("?handoff=abc&other=123&mode=test")
 *   → "?other=123"
 * 
 * clearHandoffParamsFromUrl("?handoff=abc")
 *   → "" (empty string, no params left)
 * 
 * clearHandoffParamsFromUrl("/app#section")
 *   → "/app#section" (no change, no handoff params)
 */

