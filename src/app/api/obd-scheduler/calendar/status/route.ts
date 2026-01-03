/**
 * OBD Scheduler & Booking - Calendar Integration Status API Route (Phase 3B V3.1)
 * 
 * GET: Get calendar integration status for business
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import type {
  CalendarIntegrationStatusResponse,
  SchedulerCalendarConnection,
} from "@/lib/apps/obd-scheduler/types";

export const runtime = "nodejs";

// Helper: Format integration from DB
function formatIntegration(integration: any): SchedulerCalendarConnection | null {
  if (!integration) return null;
  
  // Map enabled boolean to status string
  const status: "disabled" | "connected" | "error" = integration.enabled ? "connected" : "disabled";
  
  return {
    id: integration.id,
    businessId: integration.businessId,
    provider: integration.provider as "google" | "microsoft",
    status,
    lastSyncAt: null, // Not in schema yet
    calendarId: null, // Not in schema yet
    tokenRef: null, // Not in schema yet
    errorMessage: null, // Not in schema yet
    createdAt: integration.createdAt.toISOString(),
    updatedAt: integration.updatedAt.toISOString(),
  };
}

/**
 * GET /api/obd-scheduler/calendar/status
 * Get calendar integration status
 */
export async function GET(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    // Get integration for Google (V3.1: Google only)
    const integration = await prisma.schedulerCalendarConnection.findUnique({
      where: {
        businessId_provider: {
          businessId,
          provider: "google",
        },
      },
    });

    // Check if OAuth is configured (env vars present)
    const oauthConfigured = !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
    );

    // Determine if connection is possible (enabled = connected)
    const canConnect = oauthConfigured && (!integration || !integration.enabled);

    const response: CalendarIntegrationStatusResponse = {
      integration: formatIntegration(integration),
      oauthConfigured,
      canConnect,
    };

    return apiSuccessResponse(response);
  } catch (error) {
    return handleApiError(error);
  }
}
