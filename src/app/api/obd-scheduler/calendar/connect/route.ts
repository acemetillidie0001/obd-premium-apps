/**
 * OBD Scheduler & Booking - Calendar Connect API Route (Phase 3B V3.1)
 * 
 * POST: Initiate calendar connection (stub - OAuth not wired yet)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { z } from "zod";

export const runtime = "nodejs";

// Validation schema
const connectCalendarSchema = z.object({
  provider: z.enum(["google"]), // V3.1: Google only
});

/**
 * POST /api/obd-scheduler/calendar/connect
 * Initiate calendar connection (stub)
 * 
 * TODO (V3.1 Next Step): Wire up OAuth flow
 * - Generate OAuth state token
 * - Redirect to Google OAuth URL
 * - Handle callback in /api/obd-scheduler/calendar/callback/google
 */
export async function POST(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3.1: userId = businessId

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request body
    const parsed = connectCalendarSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const { provider } = parsed.data;

    // Check if OAuth is configured
    const oauthConfigured = !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
    );

    if (!oauthConfigured) {
      return apiErrorResponse(
        "Calendar OAuth is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.",
        "OAUTH_NOT_CONFIGURED",
        503
      );
    }

    // TODO (V3.1 Next Step): Implement OAuth flow
    // 1. Generate state token for CSRF protection
    // 2. Store state token in session or database
    // 3. Generate Google OAuth URL
    // 4. Return redirect URL or redirect directly
    
    // For now, return stub response
    return apiErrorResponse(
      "Calendar connection not yet implemented. OAuth flow will be wired in next step.",
      "NOT_IMPLEMENTED",
      501
    );
  } catch (error) {
    return handleApiError(error);
  }
}

