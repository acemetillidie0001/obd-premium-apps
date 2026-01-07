/**
 * OBD Scheduler & Booking - Requests API Route (V3)
 * 
 * GET: List booking requests (scoped to business)
 * POST: Create booking request (public form or authenticated)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse, logSchedulerEventWithBusiness } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { z } from "zod";
import { sanitizeSingleLine, sanitizeText } from "@/lib/utils/sanitizeText";
import type {
  BookingRequest,
  BookingStatus,
  CreateBookingRequestRequest,
  BookingRequestListQuery,
  BookingRequestListResponse,
} from "@/lib/apps/obd-scheduler/types";
import {
  sendCustomerRequestConfirmationEmail,
  sendBusinessRequestNotificationEmail,
} from "@/lib/apps/obd-scheduler/notifications";
import { syncBookingToCrm } from "@/lib/apps/obd-scheduler/integrations/crm";
import { BookingStatus as PrismaBookingStatus } from "@prisma/client";

export const runtime = "nodejs";

// In-memory rate limiter for public booking requests (anti-spam)
// Bounded with TTL expiration and max size cap to prevent memory growth
interface BookingRateLimitEntry {
  count: number;
  resetAt: number; // Timestamp when counter resets (TTL expiration)
  createdAt: number; // Timestamp when entry was created (for oldest-first eviction)
}

const bookingRateLimitStore = new Map<string, BookingRateLimitEntry>();
// Max size cap: prevents unbounded memory growth
const MAX_STORE_SIZE = 10000;
// TTL: entries expire after rate limit window (10 minutes)
const MAX_REQUESTS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Extract client IP from request headers
 */
function getClientIP(request: NextRequest): string | null {
  try {
    // Check x-forwarded-for header (first value if comma-separated)
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      const firstIP = forwardedFor.split(",")[0]?.trim();
      if (firstIP) return firstIP;
    }

    // Fallback to x-real-ip
    const realIP = request.headers.get("x-real-ip");
    if (realIP) return realIP.trim();

    // Last resort: try to get from NextRequest (may not always be available)
    // Note: request.ip might not be available in all environments
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if booking request is allowed (rate limit check)
 * Returns true if allowed, false if rate limited
 * 
 * Performs lightweight cleanup on each request to prevent unbounded growth.
 * TTL expiration: entries automatically expire after RATE_LIMIT_WINDOW_MS.
 * Max size cap: if store exceeds MAX_STORE_SIZE, oldest entries are evicted.
 */
function checkBookingRateLimit(bookingKey: string, ip: string | null, request: NextRequest): boolean {
  try {
    // Lightweight cleanup on each request: remove expired entries (TTL-based expiration)
    // This prevents unbounded growth without significant performance impact
    if (bookingRateLimitStore.size > 0) {
      cleanupExpiredEntries();
    }

    // Build rate limit key: bookingKey:ip with fallback if IP is null
    // P1-7: If IP extraction fails, use user agent hash as fallback to avoid collision risk
    let rateLimitKey: string;
    if (ip) {
      rateLimitKey = `${bookingKey}:${ip}`;
    } else {
      // Fallback: use user agent hash to differentiate users when IP is unavailable
      const userAgent = request.headers.get("user-agent") || "unknown";
      // Simple hash function for user agent (djb2 algorithm)
      let hash = 5381;
      for (let i = 0; i < userAgent.length; i++) {
        hash = ((hash << 5) + hash) + userAgent.charCodeAt(i);
      }
      const uaHash = Math.abs(hash).toString(36).substring(0, 8);
      rateLimitKey = `${bookingKey}:ua:${uaHash}`;
      // Log when IP extraction fails for monitoring (P1-7)
      console.warn(`[Booking Rate Limit] IP extraction failed, using user agent hash fallback for bookingKey: ${bookingKey.substring(0, 8)}...`);
    }

    const now = Date.now();
    const resetAt = now + RATE_LIMIT_WINDOW_MS;

    const entry = bookingRateLimitStore.get(rateLimitKey);

    if (!entry) {
      // First request: create entry
      // Enforce max size cap: if still at max after cleanup, evict oldest entries
      if (bookingRateLimitStore.size >= MAX_STORE_SIZE) {
        evictOldestEntries();
      }
      bookingRateLimitStore.set(rateLimitKey, { count: 1, resetAt, createdAt: now });
      return true;
    }

    // Check if entry has expired (TTL expiration)
    if (now >= entry.resetAt) {
      // Reset counter (entry TTL expired, reset for new window)
      bookingRateLimitStore.set(rateLimitKey, { count: 1, resetAt, createdAt: now });
      return true;
    }

    // Check if limit exceeded
    if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
      return false;
    }

    // Increment counter
    entry.count++;
    return true;
  } catch (error) {
    // If rate limiting fails, fail open (allow request) to avoid blocking legitimate bookings
    console.warn("[Booking Rate Limit] Error checking rate limit, allowing request:", error);
    return true;
  }
}

/**
 * Lightweight cleanup: remove expired entries (TTL-based expiration)
 * Called on each request to prevent unbounded growth.
 * Only iterates through entries once, removing those past their resetAt timestamp.
 */
function cleanupExpiredEntries(): void {
  try {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of bookingRateLimitStore.entries()) {
      if (now >= entry.resetAt) {
        bookingRateLimitStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.info(`[Booking Rate Limit] Cleaned up ${cleaned} expired entries (TTL expiration)`);
    }
  } catch (error) {
    console.warn("[Booking Rate Limit] Error during cleanup:", error);
  }
}

/**
 * Enforce max size cap: evict oldest entries when store exceeds MAX_STORE_SIZE
 * Removes entries with oldest createdAt timestamps until under the cap.
 * This ensures the store never grows unbounded even if cleanup doesn't remove enough.
 */
function evictOldestEntries(): void {
  try {
    const targetSize = Math.floor(MAX_STORE_SIZE * 0.9); // Evict down to 90% of max
    const entriesToRemove = bookingRateLimitStore.size - targetSize;

    if (entriesToRemove <= 0) {
      return;
    }

    // Convert to array, sort by createdAt (oldest first), remove oldest
    const entries = Array.from(bookingRateLimitStore.entries())
      .map(([key, entry]) => ({ key, createdAt: entry.createdAt }))
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, entriesToRemove);

    for (const entry of entries) {
      bookingRateLimitStore.delete(entry.key);
    }

    if (entries.length > 0) {
      console.info(`[Booking Rate Limit] Evicted ${entries.length} oldest entries (max size cap enforcement)`);
    }
  } catch (error) {
    console.warn("[Booking Rate Limit] Error during eviction:", error);
  }
}

// Validation schemas
const createRequestSchema = z.object({
  serviceId: z.string().optional().nullable(),
  customerName: z.string().min(1, "Customer name is required").max(200),
  customerEmail: z.string().email("Invalid email format"),
  customerPhone: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .refine(
      (val) => {
        // P1-13: Validate phone format if provided (US-friendly, E.164 compatible)
        if (!val || !val.trim()) return true; // Optional field
        const trimmed = val.trim();
        const digitsOnly = trimmed.replace(/\D/g, "");
        // Require at least 10 digits, max 15 digits (E.164)
        if (digitsOnly.length < 10 || digitsOnly.length > 15) return false;
        // Allow only valid formatting characters
        return /^[\d\s()+\-\.]+$/.test(trimmed);
      },
      {
        message: "Phone number must contain 10-15 digits and use only valid formatting characters (spaces, parentheses, dashes, plus, periods)",
      }
    ),
  preferredStart: z.string().datetime().optional().nullable(),
  preferredEnd: z.string().datetime().optional().nullable(), // Ignored for backward compatibility
  message: z.string().max(2000).optional().nullable(),
  bookingKey: z.string().optional(), // For public form
});

// Helper: Format request from DB
function formatRequest(request: any): BookingRequest {
  return {
    id: request.id,
    businessId: request.businessId,
    serviceId: request.serviceId,
    customerName: request.customerName,
    customerEmail: request.customerEmail,
    customerPhone: request.customerPhone,
    preferredStart: request.preferredStart?.toISOString() || null,
    preferredEnd: request.preferredEnd?.toISOString() || null,
    message: request.message,
    status: request.status as BookingStatus,
    proposedStart: request.proposedStart?.toISOString() || null,
    proposedEnd: request.proposedEnd?.toISOString() || null,
    internalNotes: request.internalNotes,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    service: request.service ? {
      id: request.service.id,
      businessId: request.service.businessId,
      name: request.service.name,
      durationMinutes: request.service.durationMinutes,
      description: request.service.description,
      active: request.service.active,
      paymentRequired: request.service.paymentRequired,
      depositAmountCents: request.service.depositAmountCents,
      currency: request.service.currency,
      createdAt: request.service.createdAt.toISOString(),
      updatedAt: request.service.updatedAt.toISOString(),
    } : null,
  };
}

/**
 * GET /api/obd-scheduler/requests
 * List booking requests (authenticated, scoped to business)
 */
export async function GET(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const prisma = getPrisma();
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    // Validate businessId
    const businessId = user.id; // V3: userId = businessId
    if (!businessId || typeof businessId !== "string") {
      return apiErrorResponse("Invalid business ID", "UNAUTHORIZED", 401);
    }

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as BookingStatus | null;
    const serviceId = searchParams.get("serviceId") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const sort = (searchParams.get("sort") || "createdAt") as "createdAt" | "updatedAt" | "preferredStart";
    const order = (searchParams.get("order") || "desc") as "asc" | "desc";

    // Build where clause
    const where: any = {
      businessId,
    };

    if (status) {
      where.status = status;
    }

    if (serviceId) {
      where.serviceId = serviceId;
    }

    // Search filter (customer name, email)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { customerName: { contains: searchTerm, mode: "insensitive" } },
        { customerEmail: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    // Get total count (returns 0 if none exist - this is expected for first-run)
    // Empty state is valid - never return error for empty results
    let total = 0;
    let requests: any[] = [];

    try {
      total = await prisma.bookingRequest.count({ where });
      
      // Get requests (returns empty array if none exist - this is expected for first-run)
      requests = await prisma.bookingRequest.findMany({
        where,
        include: {
          service: true,
        },
        orderBy: {
          [sort]: order,
        },
        skip: (page - 1) * limit,
        take: limit,
      });
    } catch (prismaError) {
      // Check if this is a real database error (connection, table missing, etc.)
      const errorMessage = prismaError instanceof Error ? prismaError.message.toLowerCase() : String(prismaError).toLowerCase();
      
      // If it's a connection/table error, return DATABASE_ERROR
      if (
        errorMessage.includes("connection") ||
        errorMessage.includes("relation") ||
        errorMessage.includes("does not exist") ||
        errorMessage.includes("p1001") ||
        errorMessage.includes("p2025")
      ) {
        console.error("[OBD Scheduler Requests] Database error:", prismaError);
        return handleApiError(prismaError);
      }
      
      // For other Prisma errors, log and return empty array (fail gracefully)
      console.warn("[OBD Scheduler Requests] Prisma error (returning empty array):", prismaError);
      total = 0;
      requests = [];
    }

    // Empty array is a valid response - never return error for empty state
    const response: BookingRequestListResponse = {
      requests: requests.map(formatRequest),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return apiSuccessResponse(response);
  } catch (error) {
    // Log server-side for debugging
    console.error("[OBD Scheduler Requests] Unexpected error:", error);
    
    // Only return 500 for real Prisma/database errors
    // Empty results are handled above (returns empty array, not error)
    return handleApiError(error);
  }
}

/**
 * POST /api/obd-scheduler/requests
 * Create a new booking request (public form or authenticated)
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request, "obd-scheduler:requests");
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const prisma = getPrisma();
    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request body
    const parsed = createRequestSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // preferredEnd is ignored for backward compatibility (always set to null for new requests)

    // Normalize preferredStart to 15-minute increments (round down to previous 15-min mark)
    if (body.preferredStart) {
      try {
        const date = new Date(body.preferredStart);
        const minutes = date.getMinutes();
        const validMinutes = [0, 15, 30, 45];
        
        if (!validMinutes.includes(minutes)) {
          // Round down to previous 15-minute mark (user-friendly - doesn't push time forward)
          const roundedMinutes = Math.floor(minutes / 15) * 15;
          date.setMinutes(roundedMinutes);
          date.setSeconds(0);
          date.setMilliseconds(0);
          body.preferredStart = date.toISOString();
        } else {
          // Ensure seconds and milliseconds are 0 even if minutes are valid
          date.setSeconds(0);
          date.setMilliseconds(0);
          body.preferredStart = date.toISOString();
        }
      } catch (error) {
        // If date parsing fails, return validation error
        return apiErrorResponse(
          "Invalid preferred start time format",
          "VALIDATION_ERROR",
          400
        );
      }
    }

    // Determine businessId
    let businessId: string;
    
    if (body.bookingKey) {
      // Public form: check rate limit first (anti-spam protection)
      try {
        const clientIP = getClientIP(request);
        if (!checkBookingRateLimit(body.bookingKey, clientIP, request)) {
          return apiErrorResponse(
            "Too many booking requests. Please wait a few minutes and try again.",
            "RATE_LIMITED",
            429
          );
        }
      } catch (error) {
        // Rate limit check failed - log but allow request to proceed (fail open)
        console.warn("[Booking Rate Limit] Rate limit check failed, allowing request:", error);
      }

      // Public form: look up business by bookingKey
      const settings = await prisma.bookingSettings.findUnique({
        where: { bookingKey: body.bookingKey },
        select: { businessId: true },
      });

      if (!settings) {
        return apiErrorResponse("Invalid booking key", "NOT_FOUND", 404);
      }

      businessId = settings.businessId;
    } else {
      // Authenticated: use current user's businessId
      const guard = await requirePremiumAccess();
      if (guard) return guard;

      const user = await getCurrentUser();
      if (!user) {
        return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
      }

      businessId = user.id; // V3: userId = businessId

      // Check pilot access (only for authenticated requests)
      if (!isSchedulerPilotAllowed(businessId)) {
        return apiErrorResponse(
          "Scheduler is currently in pilot rollout.",
          "PILOT_ONLY",
          403
        );
      }
    }

    // Verify service exists and belongs to business (if provided)
    if (body.serviceId) {
      const service = await prisma.bookingService.findFirst({
        where: {
          id: body.serviceId,
          businessId,
          active: true,
        },
      });

      if (!service) {
        logSchedulerEventWithBusiness("INVALID_SERVICE", businessId, {
          route: "/api/obd-scheduler/requests",
        });
        return apiErrorResponse("Service not found or inactive", "INVALID_SERVICE", 400);
      }
    }

    // P2-5: Check for duplicate submission (idempotency)
    // Normalize fields for duplicate detection (matches what we'll store)
    const normalizedPayload = {
      customerName: (body.customerName || "").trim(),
      customerEmail: (body.customerEmail || "").trim().toLowerCase(),
      customerPhone: body.customerPhone ? (body.customerPhone || "").trim() : null,
      preferredStart: body.preferredStart ? new Date(body.preferredStart) : null,
      serviceId: body.serviceId || null,
    };

    // Check for existing request with same key fields within last 30 minutes
    const idempotencyWindowMs = 30 * 60 * 1000; // 30 minutes
    const windowStart = new Date(Date.now() - idempotencyWindowMs);

    const existingRequest = await prisma.bookingRequest.findFirst({
      where: {
        businessId,
        customerEmail: normalizedPayload.customerEmail,
        preferredStart: normalizedPayload.preferredStart ? new Date(normalizedPayload.preferredStart) : null,
        createdAt: {
          gte: windowStart,
        },
        // Additional matching criteria to reduce false positives
        customerName: normalizedPayload.customerName,
        serviceId: normalizedPayload.serviceId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        service: true,
      },
    });

    // If duplicate found, return existing request with warning
    if (existingRequest) {
      // Verify it's actually a duplicate by comparing key fields
      const isDuplicate =
        existingRequest.customerEmail === normalizedPayload.customerEmail &&
        existingRequest.customerName === normalizedPayload.customerName &&
        ((!existingRequest.preferredStart && !normalizedPayload.preferredStart) ||
          (existingRequest.preferredStart &&
            normalizedPayload.preferredStart &&
            Math.abs(
              new Date(existingRequest.preferredStart).getTime() -
                new Date(normalizedPayload.preferredStart).getTime()
            ) < 60000)) && // Within 1 minute
        existingRequest.serviceId === normalizedPayload.serviceId;

      if (isDuplicate) {
        logSchedulerEventWithBusiness("DUPLICATE_SUBMISSION_BLOCKED", businessId, {
          route: "/api/obd-scheduler/requests",
        });
        const formatted = formatRequest(existingRequest);
        const response = apiSuccessResponse(formatted, 200);

        // Return with warning
        const responseData = await response.json();
        return NextResponse.json(
          {
            ...responseData,
            warnings: ["Duplicate submission detected — using existing request."],
          },
          { status: 200 }
        );
      }
    }

    // Create request
    const bookingRequest = await prisma.bookingRequest.create({
      data: {
        businessId,
        serviceId: body.serviceId || null,
        customerName: sanitizeSingleLine(body.customerName),
        customerEmail: sanitizeSingleLine(body.customerEmail).toLowerCase(),
        customerPhone: body.customerPhone ? sanitizeSingleLine(body.customerPhone) : null,
        preferredStart: body.preferredStart ? new Date(body.preferredStart) : null,
        preferredEnd: null, // Always null for new requests (start-only preferred time)
        message: body.message ? sanitizeText(body.message) : null,
        status: PrismaBookingStatus.REQUESTED,
      },
      include: {
        service: true,
      },
    });

    const formatted = formatRequest(bookingRequest);

    // Get business name and notification email from settings
    let businessName = "Business";
    let notificationEmail: string | null = null;

    try {
      const bookingSettings = await prisma.bookingSettings.findUnique({
        where: { businessId },
        select: { notificationEmail: true },
      });

      if (bookingSettings?.notificationEmail) {
        notificationEmail = bookingSettings.notificationEmail;
      }

      // Try to get business name from BrandProfile
      const brandProfile = await prisma.brandProfile.findUnique({
        where: { userId: businessId },
        select: { businessName: true },
      });

      if (brandProfile?.businessName) {
        businessName = brandProfile.businessName;
      }
    } catch (error) {
      // Log but don't fail the booking request
      console.warn("[OBD Scheduler] Failed to fetch settings/brand profile (non-blocking):", error);
    }

    // Collect warnings (non-blocking) - P1-9: Include CRM sync failures
    const warnings: string[] = [];

    // P1-9: Sync to CRM (non-blocking, fails gracefully) and add to warnings if it fails
    try {
      await syncBookingToCrm({
        businessId,
        request: formatted,
        service: formatted.service,
      });
    } catch (crmError) {
      const errorMessage = crmError instanceof Error ? crmError.message : String(crmError);
      console.warn("[OBD Scheduler] CRM sync failed (non-blocking):", errorMessage);
      warnings.push("CRM sync failed — request was saved, but may not appear in CRM automatically.");
    }

    // Send customer confirmation email (non-blocking)
    try {
      await sendCustomerRequestConfirmationEmail({
        request: formatted,
        service: formatted.service,
        businessName,
      });
    } catch (emailError) {
      // Log but don't fail the booking request
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      console.warn(`[OBD Scheduler] Customer confirmation email failed (non-blocking) for requestId ${formatted.id}:`, errorMessage);
      warnings.push("Confirmation email could not be sent.");
    }

    // Send business notification email (non-blocking, only if notificationEmail is set)
    if (notificationEmail) {
      try {
        await sendBusinessRequestNotificationEmail(
          {
            request: formatted,
            service: formatted.service,
            businessName,
          },
          notificationEmail
        );
      } catch (emailError) {
        // Log but don't fail the booking request
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        console.warn(`[OBD Scheduler] Business notification email failed (non-blocking) for requestId ${formatted.id}, businessId ${businessId}:`, errorMessage);
        warnings.push("Business notification email could not be sent.");
      }
    } else {
      // Log warning if notification email is not configured
      console.warn(`[OBD Scheduler] Notification email not configured for businessId ${businessId} (requestId: ${formatted.id}). Please set notificationEmail in booking settings.`);
    }

    // Send SMS notification (non-blocking, behind feature flag)
    if (formatted.customerPhone) {
      try {
        // Dynamic import to avoid loading Twilio if SMS is disabled
        const { sendTransactionalSms } = await import("@/lib/sms/sendSms");
        const { shouldSendSmsNow } = await import("@/lib/sms/quietHours");
        const { allowSmsSend } = await import("@/lib/sms/smsRateLimit");
        const { isSmsEnabled } = await import("@/lib/sms/twilioClient");

        if (isSmsEnabled()) {
          const quietCheck = shouldSendSmsNow();
          const rateLimitKey = `${businessId}:${formatted.customerPhone}`;
          
          if (quietCheck.ok && allowSmsSend(rateLimitKey)) {
            await sendTransactionalSms(
              formatted.customerPhone,
              "REQUEST_RECEIVED",
              { businessName }
            );
          }
        }
      } catch (smsError) {
        // Log but don't fail the booking request
        const errorMessage = smsError instanceof Error ? smsError.message : String(smsError);
        console.warn(`[OBD Scheduler] SMS failed (non-blocking) for requestId ${formatted.id}:`, errorMessage);
      }
    }

    // Return response with optional warnings
    const response = apiSuccessResponse(formatted, 201);
    const responseData = await response.json();
    
    // Add warnings if any exist
    if (warnings.length > 0) {
      return NextResponse.json(
        {
          ...responseData,
          warnings,
        },
        { status: 201 }
      );
    }

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

