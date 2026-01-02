/**
 * OBD Scheduler & Booking - Public Context API Route (V3)
 * 
 * GET: Get business context by bookingKey (for public booking form)
 * This endpoint is public (no authentication required) but validates bookingKey.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { validateBookingKeyFormat } from "@/lib/apps/obd-scheduler/bookingKey";
import { resolveBookingLink } from "@/lib/apps/obd-scheduler/bookingPublicLink";

export const runtime = "nodejs";

// In-memory rate limiter for public context requests (P1-16: prevent booking key enumeration)
interface ContextRateLimitEntry {
  count: number;
  resetAt: number; // Timestamp when counter resets (TTL expiration)
  createdAt: number; // Timestamp when entry was created (for oldest-first eviction)
}

const contextRateLimitStore = new Map<string, ContextRateLimitEntry>();
const MAX_STORE_SIZE = 10000;
const MAX_REQUESTS_PER_WINDOW = 60; // Conservative limit: 60 requests per window
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Extract client IP from request headers
 */
function getClientIP(request: NextRequest): string | null {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      const firstIP = forwardedFor.split(",")[0]?.trim();
      if (firstIP) return firstIP;
    }
    const realIP = request.headers.get("x-real-ip");
    if (realIP) return realIP.trim();
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if context request is allowed (rate limit check)
 * Returns true if allowed, false if rate limited
 */
function checkContextRateLimit(ip: string | null, request: NextRequest): boolean {
  try {
    // Lightweight cleanup on each request
    if (contextRateLimitStore.size > 0) {
      const now = Date.now();
      for (const [key, entry] of contextRateLimitStore.entries()) {
        if (now >= entry.resetAt) {
          contextRateLimitStore.delete(key);
        }
      }
    }

    // Build rate limit key: IP or UA hash fallback (same pattern as P1-7)
    let rateLimitKey: string;
    if (ip) {
      rateLimitKey = `context:${ip}`;
    } else {
      const userAgent = request.headers.get("user-agent") || "unknown";
      let hash = 5381;
      for (let i = 0; i < userAgent.length; i++) {
        hash = ((hash << 5) + hash) + userAgent.charCodeAt(i);
      }
      const uaHash = Math.abs(hash).toString(36).substring(0, 8);
      rateLimitKey = `context:ua:${uaHash}`;
    }

    const now = Date.now();
    const resetAt = now + RATE_LIMIT_WINDOW_MS;

    const entry = contextRateLimitStore.get(rateLimitKey);

    if (!entry) {
      if (contextRateLimitStore.size >= MAX_STORE_SIZE) {
        // Evict oldest entries if at max size
        const entries = Array.from(contextRateLimitStore.entries())
          .sort((a, b) => a[1].createdAt - b[1].createdAt);
        const toEvict = Math.floor(MAX_STORE_SIZE * 0.1); // Evict 10%
        for (let i = 0; i < toEvict; i++) {
          contextRateLimitStore.delete(entries[i][0]);
        }
      }
      contextRateLimitStore.set(rateLimitKey, { count: 1, resetAt, createdAt: now });
      return true;
    }

    if (now >= entry.resetAt) {
      contextRateLimitStore.set(rateLimitKey, { count: 1, resetAt, createdAt: now });
      return true;
    }

    if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
      return false;
    }

    entry.count++;
    return true;
  } catch (error) {
    // Fail open (allow request) to avoid blocking legitimate users
    console.warn("[Context Rate Limit] Error checking rate limit, allowing request:", error);
    return true;
  }
}

/**
 * Log failed booking key lookup for security/audit (P1-16)
 */
function logFailedBookingKeyLookup(
  bookingKey: string | null,
  ip: string | null,
  request: NextRequest,
  outcome: "invalid_format" | "not_found"
): void {
  try {
    const userAgent = request.headers.get("user-agent") || "unknown";
    let uaHash = "unknown";
    try {
      let hash = 5381;
      for (let i = 0; i < userAgent.length; i++) {
        hash = ((hash << 5) + hash) + userAgent.charCodeAt(i);
      }
      uaHash = Math.abs(hash).toString(36).substring(0, 8);
    } catch {
      // Ignore hash errors
    }

    const keyPrefix = bookingKey ? bookingKey.substring(0, 6) : "null";
    const timestamp = new Date().toISOString();
    const ipDisplay = ip || "unknown";

    console.warn(
      `[Public Context Audit] Failed booking key lookup - ` +
      `timestamp: ${timestamp}, ` +
      `ip: ${ipDisplay}, ` +
      `ua_hash: ${uaHash}, ` +
      `key_prefix: ${keyPrefix}, ` +
      `outcome: ${outcome}`
    );
  } catch (error) {
    // Silently ignore logging errors to avoid affecting request flow
    console.warn("[Public Context Audit] Error logging failed lookup:", error);
  }
}

/**
 * GET /api/obd-scheduler/public/context
 * Get business context by bookingKey
 */
export async function GET(request: NextRequest) {
  try {
    // P1-16: Rate limit context requests to prevent booking key enumeration
    const clientIP = getClientIP(request);
    if (!checkContextRateLimit(clientIP, request)) {
      return apiErrorResponse(
        "Too many requests. Please wait a few minutes and try again.",
        "RATE_LIMITED",
        429
      );
    }

    const { searchParams } = new URL(request.url);
    // Accept both 'key' and 'bookingKey' query params for flexibility
    const bookingParam = searchParams.get("key") || searchParams.get("bookingKey");

    if (!bookingParam) {
      return apiErrorResponse("Booking key is required", "VALIDATION_ERROR", 400);
    }

    // Resolve booking link (supports short code, slug-code, and legacy bookingKey)
    const resolution = await resolveBookingLink(bookingParam);

    if (!resolution) {
      // P1-16: Log failed lookup for security/audit
      // Check if it looks like a legacy bookingKey format for logging
      const isLegacyFormat = bookingParam.length === 64 && /^[0-9a-f]+$/i.test(bookingParam);
      logFailedBookingKeyLookup(bookingParam, clientIP, request, isLegacyFormat ? "not_found" : "invalid_format");
      return apiErrorResponse("Invalid booking link", "NOT_FOUND", 404);
    }

    // Find settings by businessId
    const settings = await prisma.bookingSettings.findUnique({
      where: { businessId: resolution.businessId },
      select: {
        businessId: true,
        bookingModeDefault: true,
        timezone: true,
        bufferMinutes: true,
        minNoticeHours: true,
        maxDaysOut: true,
        policyText: true,
      },
    });

    if (!settings) {
      // P1-16: Log failed lookup for security/audit
      logFailedBookingKeyLookup(bookingParam, clientIP, request, "not_found");
      return apiErrorResponse("Invalid booking link", "NOT_FOUND", 404);
    }

    // Get active services for this business
    const services = await prisma.bookingService.findMany({
      where: {
        businessId: settings.businessId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        description: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Get business name from BrandProfile and logo from BookingTheme
    // These are optional - missing records should not cause errors
    let businessName: string | null = null;
    let logoUrl: string | null = null;

    try {
      const [brandProfile, bookingTheme] = await Promise.all([
        prisma.brandProfile.findUnique({
          where: { userId: settings.businessId },
          select: { businessName: true },
        }).catch(() => null),
        prisma.bookingTheme.findUnique({
          where: { businessId: settings.businessId },
          select: { logoUrl: true },
        }).catch(() => null),
      ]);

      businessName = brandProfile?.businessName || null;
      logoUrl = bookingTheme?.logoUrl || null;
    } catch (lookupError) {
      // If optional lookups fail, continue with null values
      // This prevents crashes when BrandProfile or BookingTheme are missing
      console.warn("[Public Context] Optional business data lookup failed:", lookupError);
    }

    return apiSuccessResponse({
      businessId: settings.businessId,
      bookingModeDefault: settings.bookingModeDefault,
      timezone: settings.timezone,
      bufferMinutes: settings.bufferMinutes,
      minNoticeHours: settings.minNoticeHours,
      maxDaysOut: settings.maxDaysOut,
      policyText: settings.policyText,
      services: Array.isArray(services) ? services : [],
      businessName,
      logoUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

