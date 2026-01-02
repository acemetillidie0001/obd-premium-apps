/**
 * SMS Rate Limiting (Tier 5.4A)
 * 
 * Lightweight in-memory rate limiter (best-effort, serverless-safe).
 * 
 * NOTE: This is best-effort until we add DB logs later.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // Timestamp when counter resets
}

// In-memory store: key -> entry
const rateLimitStore = new Map<string, RateLimitEntry>();

// Maximum store size to prevent memory leaks (cleanup when exceeded)
const MAX_STORE_SIZE = 10000;

/**
 * Validate rate limit parameters
 */
function validateRateLimitParams(key: string, maxPerHour: number): { valid: boolean; maxPerHour: number } {
  if (!key || typeof key !== "string" || key.length === 0) {
    return { valid: false, maxPerHour: 4 };
  }
  
  const safeMaxPerHour = Math.max(1, Math.min(100, Math.floor(maxPerHour || 4)));
  return { valid: true, maxPerHour: safeMaxPerHour };
}

/**
 * Check if SMS send is allowed for the given key
 * 
 * @param key Rate limit key (e.g., `${businessId}:${toPhone}`)
 * @param maxPerHour Maximum sends per hour (default: 4, clamped to 1-100)
 * @returns true if allowed, false if rate limited
 */
export function allowSmsSend(key: string, maxPerHour: number = 4): boolean {
  try {
    const validation = validateRateLimitParams(key, maxPerHour);
    if (!validation.valid) {
      // Invalid key - fail closed (don't allow)
      return false;
    }

    const safeMaxPerHour = validation.maxPerHour;
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const resetAt = now + oneHour;

    const entry = rateLimitStore.get(key);

    if (!entry) {
      // First request: create entry
      // Cleanup if store is getting too large
      if (rateLimitStore.size >= MAX_STORE_SIZE) {
        cleanupRateLimitStore();
      }
      rateLimitStore.set(key, { count: 1, resetAt });
      return true;
    }

    // Check if entry has expired
    if (now >= entry.resetAt) {
      // Reset counter
      rateLimitStore.set(key, { count: 1, resetAt });
      return true;
    }

    // Check if limit exceeded
    if (entry.count >= safeMaxPerHour) {
      return false;
    }

    // Increment counter
    entry.count++;
    return true;
  } catch (error) {
    // If rate limiting fails, fail open (allow SMS) to avoid blocking legitimate sends
    console.warn("[SMS Rate Limit] Error checking rate limit, allowing SMS:", error);
    return true;
  }
}

/**
 * Clean up expired entries (call periodically if needed)
 * For now, entries auto-expire on next check, but this can help memory management
 */
export function cleanupRateLimitStore(): void {
  try {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now >= entry.resetAt) {
        rateLimitStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.info(`[SMS Rate Limit] Cleaned up ${cleaned} expired entries`);
    }
  } catch (error) {
    console.warn("[SMS Rate Limit] Error during cleanup:", error);
  }
}

