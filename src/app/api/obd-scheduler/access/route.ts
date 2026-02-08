/**
 * OBD Scheduler Activation Access Endpoint
 *
 * Returns whether this tenant/business is allowed to use activation (customer-facing) features
 * while pilot rollout mode is enabled.
 *
 * GET /api/obd-scheduler/access
 *
 * Success: { ok: true, data: { ...readinessSnapshot } }
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { getPrisma } from "@/lib/prisma";
import { isSmsEnabled } from "@/lib/sms/twilioClient";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  warnIfBusinessIdParamPresent(request);

  try {
    const { businessId, role, userId } = await requireTenant();
    void role;
    void userId;
    await requirePermission("OBD_SCHEDULER", "VIEW");

    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const activationAllowed = isSchedulerPilotAllowed(businessId);
    const pilotMode =
      process.env.OBD_SCHEDULER_PILOT_MODE === "true" || process.env.OBD_SCHEDULER_PILOT_MODE === "1";

    const isPilot = pilotMode && !activationAllowed;
    const isEnabled = !isPilot;

    const oauthConfigured = !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
    );

    const [
      servicesCount,
      enabledAvailabilityWindowsCount,
      busyBlocksCount,
      theme,
      googleCalendarIntegration,
    ] = await Promise.all([
      prisma.bookingService.count({ where: { businessId } }),
      prisma.availabilityWindow.count({ where: { businessId, isEnabled: true } }),
      prisma.schedulerBusyBlock.count({ where: { businessId } }),
      prisma.bookingTheme.findUnique({ where: { businessId } }),
      prisma.schedulerCalendarConnection.findUnique({
        where: { businessId_provider: { businessId, provider: "google" } },
      }),
    ]);

    const hasAvailability = enabledAvailabilityWindowsCount > 0 || busyBlocksCount > 0;

    const hasBranding = !!(
      theme &&
      (
        theme.logoUrl ||
        theme.accentColor ||
        theme.headlineText ||
        theme.introText ||
        (theme.primaryColor && theme.primaryColor.toLowerCase() !== "#29c4a9")
      )
    );

    const smsStatus = isSmsEnabled() ? "connected" : "not_connected";

    const calendarStatus: "connected" | "not_connected" | "coming_soon" =
      googleCalendarIntegration?.enabled
        ? "connected"
        : !oauthConfigured
          ? "coming_soon"
          : "not_connected";

    return apiSuccessResponse({
      // Pilot + activation state
      isEnabled,
      isPilot,
      activationAllowed,
      pilotMode,

      // Setup readiness
      setup: {
        servicesCount,
        hasAvailability,
        hasBranding,
      },

      // Connection readiness (no external calls)
      connections: {
        sms: { status: smsStatus as "connected" | "not_connected" },
        calendar: { status: calendarStatus },
      },
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

