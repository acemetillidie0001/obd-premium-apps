/**
 * OBD Scheduler & Booking - Calendar Sync API Route (Phase 3B V3.1)
 * 
 * POST: Trigger manual calendar sync (stub - no external API calls yet)
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
const syncCalendarSchema = z.object({
  provider: z.enum(["google"]).optional().default("google"), // V3.1: Google only
});

/**
 * POST /api/obd-scheduler/calendar/sync
 * Trigger manual calendar sync (stub)
 * 
 * TODO (V3.1 Next Step): Implement actual sync logic
 * - Fetch calendar events from Google Calendar API
 * - Create/update SchedulerBusyBlock records with source="google"
 * - Delete stale synced blocks (blocks that no longer exist in calendar)
 * - Update lastSyncAt timestamp
 * - Handle errors and update status
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
    const body = json || {};

    // Validate request body (provider is optional, defaults to "google")
    const parsed = syncCalendarSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const { provider } = parsed.data;

    // Check if integration exists and is connected
    const integration = await prisma.schedulerCalendarIntegration.findUnique({
      where: {
        businessId_provider: {
          businessId,
          provider,
        },
      },
    });

    if (!integration) {
      return apiErrorResponse(
        "Calendar integration not found. Please connect your calendar first.",
        "INTEGRATION_NOT_FOUND",
        404
      );
    }

    if (integration.status !== "connected") {
      return apiErrorResponse(
        `Calendar integration is not connected. Current status: ${integration.status}`,
        "INTEGRATION_NOT_CONNECTED",
        400
      );
    }

    // TODO (V3.1 Next Step): Implement actual sync logic
    // 1. Get access token (decrypt from tokenRef or fetch from SchedulerCalendarConnection)
    // 2. Call Google Calendar API freeBusy endpoint
    // 3. Parse busy intervals
    // 4. Delete existing synced blocks for this provider
    // 5. Create new SchedulerBusyBlock records with source="google"
    // 6. Update integration.lastSyncAt
    // 7. Handle errors and update integration.status if needed
    
    // For now, return stub response
    return apiErrorResponse(
      "Calendar sync not yet implemented. Sync logic will be added in next step.",
      "NOT_IMPLEMENTED",
      501
    );
  } catch (error) {
    return handleApiError(error);
  }
}

