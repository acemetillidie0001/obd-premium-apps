/**
 * Standardized Handoff Transport
 * 
 * Provides sessionStorage-based handoff transport with TTL and safe cleanup.
 * Used across apps for sending payloads to Social Auto-Poster composer.
 */

export const HANDOFF_KEY = "obd:social-auto-poster:handoff";

export interface StoredHandoffEnvelope {
  v: 1;
  createdAt: string; // ISO timestamp
  ttlMs: number; // Time-to-live in milliseconds
  payload: unknown; // The actual handoff payload
  source: string; // Source app identifier
}

/**
 * Write handoff payload to sessionStorage with TTL
 * 
 * @param payload - The handoff payload to store
 * @param source - Source app identifier (e.g., "ai-content-writer", "offers-builder")
 * @param ttlMs - Time-to-live in milliseconds (default: 10 minutes)
 */
export function writeHandoff(
  payload: unknown,
  source: string,
  ttlMs: number = 10 * 60 * 1000 // 10 minutes default
): void {
  if (typeof window === "undefined") {
    // SSR-safe: no-op in server context
    return;
  }

  try {
    const envelope: StoredHandoffEnvelope = {
      v: 1,
      createdAt: new Date().toISOString(),
      ttlMs,
      payload,
      source,
    };

    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(envelope));
  } catch (error) {
    // sessionStorage may be unavailable (private browsing, quota exceeded, etc.)
    console.warn("Failed to write handoff to sessionStorage:", error);
  }
}

/**
 * Read handoff payload from sessionStorage
 * 
 * @returns Object with envelope, expired flag, or error
 */
export function readHandoff(): {
  envelope?: StoredHandoffEnvelope;
  expired?: boolean;
  error?: string;
} {
  if (typeof window === "undefined") {
    return { error: "Not available in SSR" };
  }

  try {
    const stored = sessionStorage.getItem(HANDOFF_KEY);
    if (!stored) {
      return {}; // No handoff found
    }

    const envelope: StoredHandoffEnvelope = JSON.parse(stored);

    // Validate envelope structure
    if (envelope.v !== 1 || !envelope.createdAt || !envelope.payload || !envelope.source) {
      // Invalid envelope - clear it
      clearHandoff();
      return { error: "Invalid handoff envelope structure" };
    }

    // Check TTL
    const createdAt = new Date(envelope.createdAt);
    const now = new Date();
    const ageMs = now.getTime() - createdAt.getTime();

    if (ageMs > envelope.ttlMs) {
      // Expired - clear it
      clearHandoff();
      return { expired: true, error: "Handoff expired" };
    }

    return { envelope };
  } catch (error) {
    // Invalid JSON or other error - clear it
    clearHandoff();
    return { error: error instanceof Error ? error.message : "Failed to read handoff" };
  }
}

/**
 * Clear handoff from sessionStorage
 */
export function clearHandoff(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(HANDOFF_KEY);
  } catch (error) {
    // sessionStorage may be unavailable - ignore
    console.warn("Failed to clear handoff from sessionStorage:", error);
  }
}

