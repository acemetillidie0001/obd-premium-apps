/**
 * Widget Rate Limit Utility
 * 
 * Lightweight rate limiting for public widget endpoints.
 * Uses in-memory storage (acceptable for V4).
 */

interface WidgetRateLimitEntry {
  count: number;
  windowStart: number;
}

// Rate limit storage: key (businessId:ip) -> entry
const widgetRateLimits = new Map<string, WidgetRateLimitEntry>();

// Rate limit configuration for widgets (more lenient than authenticated routes)
const WIDGET_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const WIDGET_RATE_LIMIT_MAX_REQUESTS = 50; // per window per businessId:IP

/**
 * Get client IP for rate limiting
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }
  return "unknown";
}

/**
 * Check rate limit for widget requests
 * 
 * @param req - The request object
 * @param businessId - The business ID from the request
 * @returns null if allowed, NextResponse with 429 if rate limited
 */
export function checkWidgetRateLimit(
  req: Request,
  businessId: string
): Response | null {
  const ip = getClientIP(req);
  const key = `${businessId}:${ip}`;
  const now = Date.now();
  const entry = widgetRateLimits.get(key);

  if (!entry || now - entry.windowStart >= WIDGET_RATE_LIMIT_WINDOW_MS) {
    // New window or expired window - reset
    widgetRateLimits.set(key, { count: 1, windowStart: now });
    return null; // Allowed
  }

  if (entry.count >= WIDGET_RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Rate limit exceeded. Please try again later.",
        code: "RATE_LIMITED",
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  entry.count++;
  return null; // Allowed
}

