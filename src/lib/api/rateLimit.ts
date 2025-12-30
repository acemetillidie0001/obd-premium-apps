import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/premium";

/**
 * Rate Limit Utility
 * 
 * Provides consistent rate limiting for premium AI routes.
 * Uses userId when available (after authentication), falls back to IP otherwise.
 * 
 * Usage:
 * ```typescript
 * export async function POST(req: Request) {
 *   // After premium guard passes, check rate limit
 *   const rateLimitCheck = await checkRateLimit(req);
 *   if (rateLimitCheck) return rateLimitCheck; // Return 429 if rate limited
 *   
 *   // Continue with route logic...
 * }
 * ```
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// Rate limit storage: key (userId or IP) -> entry
const rateLimits = new Map<string, RateLimitEntry>();

// Rate limit configuration (matches Event Campaign Builder)
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 20; // per window per user/IP

/**
 * Get client IP for rate limiting (fallback when userId unavailable)
 */
function getClientIP(req: Request): string {
  // Try various headers (for proxies, load balancers, etc.)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }
  // Fallback (may not work in all environments)
  return "global";
}

/**
 * Check rate limit for a key (userId or IP)
 */
function checkRateLimitForKey(key: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // New window or expired window - reset
    rateLimits.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limit exceeded
  }

  entry.count++;
  return true;
}

/**
 * Check rate limit for a request.
 * 
 * Prefers userId (from authenticated session) when available.
 * Falls back to IP address if userId is unavailable.
 * 
 * Returns:
 * - null if request is allowed (continue processing)
 * - NextResponse with 429 status if rate limit exceeded
 */
export async function checkRateLimit(req: Request): Promise<NextResponse | null> {
  // Try to get userId from authenticated session (preferred)
  // Note: This should be called AFTER premium guard, so user should be authenticated
  let rateLimitKey: string;
  
  try {
    const user = await getCurrentUser();
    if (user?.id) {
      // Use userId for rate limiting (preferred - per-user limits)
      rateLimitKey = `user:${user.id}`;
    } else {
      // Fallback to IP if userId unavailable
      rateLimitKey = `ip:${getClientIP(req)}`;
    }
  } catch (error) {
    // If getUser fails, fallback to IP
    rateLimitKey = `ip:${getClientIP(req)}`;
  }

  // Check rate limit
  if (!checkRateLimitForKey(rateLimitKey)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Rate limit exceeded",
        code: "RATE_LIMITED",
      },
      { status: 429 }
    );
  }

  // Rate limit check passed
  return null;
}

