/**
 * Shared Handoff Parsing Utility
 * 
 * Provides a unified way to parse handoff payloads from URL query parameters
 * or localStorage, with proper Unicode handling and SSR safety.
 */

/**
 * Result type for handoff parsing operations
 */
export type HandoffParseResult<T> =
  | { payload: T; source: "query" | "storage"; raw?: string }
  | { payload: null; error?: string };

/**
 * Decode base64url string to UTF-8 string
 * Handles Unicode safely by converting binary string to Uint8Array before decoding
 * 
 * @param encoded - Base64url-encoded string
 * @returns Decoded UTF-8 string
 * @throws Error if decoding fails
 */
export function decodeBase64UrlToString(encoded: string): string {
  // Add padding if needed
  let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }

  try {
    // Decode base64 to binary string
    const binary = atob(base64);
    // Convert binary string to UTF-8 bytes
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (error) {
    throw new Error("Failed to decode base64url string");
  }
}

/**
 * Safely parse JSON string with error handling
 * 
 * @param jsonString - JSON string to parse
 * @returns Parsed object or null if parsing fails
 */
export function tryParseJson<T = unknown>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
}

/**
 * Read handoff payload from localStorage and clear it after reading
 * SSR-safe: returns null if window is not defined
 * Unit-safe: checks guard to prevent re-reading on refresh
 * 
 * @param handoffId - The handoff ID from query parameter
 * @returns The stored payload string or null if not found/unavailable/already consumed
 */
export function readAndClearLocalStorageHandoff(handoffId: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  // Import guard functions dynamically to avoid circular dependency
  // Check if this handoffId was already consumed (unit-safe guard)
  try {
    const guardKey = `obd_handoff_consumed:${handoffId}`;
    const alreadyConsumed = sessionStorage.getItem(guardKey);
    if (alreadyConsumed === "true") {
      // Already consumed - don't read again
      return null;
    }
  } catch {
    // If sessionStorage check fails, continue (fail-safe)
  }

  try {
    const storageKey = `obd_handoff:${handoffId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      // Mark as consumed before reading (unit-safe guard)
      try {
        const guardKey = `obd_handoff_consumed:${handoffId}`;
        sessionStorage.setItem(guardKey, "true");
      } catch {
        // If marking fails, continue anyway (fail-safe)
      }
      
      // Delete from localStorage after reading (one-time use)
      localStorage.removeItem(storageKey);
      return stored;
    }
    
    return null;
  } catch (error) {
    // Silently fail if localStorage is unavailable
    console.warn("Failed to read localStorage handoff:", error);
    return null;
  }
}

/**
 * Parse handoff payload from URL query parameters or localStorage
 * 
 * Supports two patterns:
 * 1. ?handoff=<base64url-encoded-json> - Direct payload in URL
 * 2. ?handoffId=<id> - Payload stored in localStorage with key "obd_handoff:<id>"
 * 
 * The localStorage key is automatically deleted after successful read.
 * 
 * @param searchParams - URLSearchParams from the current page
 * @param validate - Type guard function to validate the parsed payload
 * @returns HandoffParseResult with payload, source, and optional error
 */
export function parseHandoffFromUrl<T>(
  searchParams: URLSearchParams,
  validate: (p: unknown) => p is T
): HandoffParseResult<T> {
  // Try query param first (?handoff=...)
  const handoff = searchParams.get("handoff");
  if (handoff) {
    try {
      const decoded = decodeBase64UrlToString(handoff);
      const parsed = tryParseJson(decoded);
      
      if (parsed === null) {
        return {
          payload: null,
          error: "Failed to parse JSON from handoff query parameter",
        };
      }
      
      if (validate(parsed)) {
        return {
          payload: parsed,
          source: "query",
          raw: decoded,
        };
      }
      
      return {
        payload: null,
        error: "Handoff payload failed validation",
      };
    } catch (error) {
      return {
        payload: null,
        error: error instanceof Error ? error.message : "Failed to decode handoff query parameter",
      };
    }
  }

  // Try localStorage fallback (?handoffId=...)
  const handoffId = searchParams.get("handoffId");
  if (handoffId) {
    const stored = readAndClearLocalStorageHandoff(handoffId);
    
    if (stored === null) {
      return {
        payload: null,
        error: "Handoff ID not found in localStorage or localStorage unavailable",
      };
    }
    
    try {
      const parsed = tryParseJson(stored);
      
      if (parsed === null) {
        return {
          payload: null,
          error: "Failed to parse JSON from localStorage handoff",
        };
      }
      
      if (validate(parsed)) {
        return {
          payload: parsed,
          source: "storage",
          raw: stored,
        };
      }
      
      return {
        payload: null,
        error: "Handoff payload from localStorage failed validation",
      };
    } catch (error) {
      return {
        payload: null,
        error: error instanceof Error ? error.message : "Failed to process localStorage handoff",
      };
    }
  }

  // No handoff found
  return {
    payload: null,
    error: "No handoff parameter found in URL",
  };
}

