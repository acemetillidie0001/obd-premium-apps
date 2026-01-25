/**
 * OBD Scheduler & Booking - Metrics API Route
 * 
 * GET: Fetch business metrics for the scheduler
 * P1-24: Missing Business Metrics
 * Authenticated, scoped to businessId
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant } from "@/lib/auth/tenant";
import { BookingStatus as PrismaBookingStatus } from "@prisma/client";

export const runtime = "nodejs";

type MetricsRange = "7d" | "30d" | "90d";

/**
 * Calculate date range from range string
 */
function getDateRange(range: MetricsRange): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  
  switch (range) {
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
  }
  start.setHours(0, 0, 0, 0);
  
  return { start, end };
}

/**
 * GET /api/obd-scheduler/metrics?range=7d|30d|90d
 * Fetch business metrics
 */
export async function GET(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request, "obd-scheduler:metrics");
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const prisma = getPrisma();
    const { businessId, role, userId } = await requireTenant();
    void role;
    void userId;
    await requirePermission("OBD_SCHEDULER", "VIEW");

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }
    
    // Parse range parameter
    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get("range") || "30d";
    const range: MetricsRange = rangeParam === "7d" || rangeParam === "30d" || rangeParam === "90d" 
      ? rangeParam 
      : "30d";
    
    const { start, end } = getDateRange(range);

    // Fetch all requests in date range
    const requests = await prisma.bookingRequest.findMany({
      where: {
        businessId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
          },
        },
        auditLogs: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            action: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Calculate metrics
    const totalRequests = requests.length;
    
    // Requests by status
    const requestsByStatus: Record<string, number> = {
      REQUESTED: 0,
      APPROVED: 0,
      DECLINED: 0,
      PROPOSED_TIME: 0,
      COMPLETED: 0,
      CANCELED: 0,
    };
    
    requests.forEach((req) => {
      const status = req.status as string;
      if (status in requestsByStatus) {
        requestsByStatus[status]++;
      }
    });

    // Conversion rate (approved / total)
    const conversionRate = totalRequests > 0 
      ? (requestsByStatus.APPROVED / totalRequests) * 100 
      : 0;

    // Median time to first response (first status change from REQUESTED)
    const firstResponseTimes: number[] = [];
    requests.forEach((req) => {
      const firstAudit = req.auditLogs.find(
        (log) => log.fromStatus === PrismaBookingStatus.REQUESTED && 
                 log.action !== "reactivate"
      );
      if (firstAudit) {
        const responseTime = firstAudit.createdAt.getTime() - req.createdAt.getTime();
        if (responseTime > 0) {
          firstResponseTimes.push(responseTime);
        }
      }
    });
    firstResponseTimes.sort((a, b) => a - b);
    const medianTimeToFirstResponse = firstResponseTimes.length > 0
      ? firstResponseTimes[Math.floor(firstResponseTimes.length / 2)]
      : null;

    // Median time to approval (REQUESTED -> APPROVED)
    const approvalTimes: number[] = [];
    requests.forEach((req) => {
      const approvalAudit = req.auditLogs.find(
        (log) => log.fromStatus === PrismaBookingStatus.REQUESTED && 
                 log.toStatus === PrismaBookingStatus.APPROVED
      );
      if (approvalAudit) {
        const approvalTime = approvalAudit.createdAt.getTime() - req.createdAt.getTime();
        if (approvalTime > 0) {
          approvalTimes.push(approvalTime);
        }
      }
    });
    approvalTimes.sort((a, b) => a - b);
    const medianTimeToApproval = approvalTimes.length > 0
      ? approvalTimes[Math.floor(approvalTimes.length / 2)]
      : null;

    // Service popularity
    const serviceCounts = new Map<string, { count: number; name: string }>();
    requests.forEach((req) => {
      if (req.serviceId) {
        const serviceName = req.service?.name || "Unknown Service";
        const existing = serviceCounts.get(req.serviceId) || { count: 0, name: serviceName };
        existing.count++;
        serviceCounts.set(req.serviceId, existing);
      }
    });
    const servicePopularity = Array.from(serviceCounts.entries())
      .map(([serviceId, data]) => ({
        serviceId,
        serviceName: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);

    // Peak hours (histogram by hour of day of submissions)
    const hourCounts = new Array(24).fill(0);
    requests.forEach((req) => {
      const hour = req.createdAt.getHours();
      hourCounts[hour]++;
    });
    const peakHours = hourCounts.map((count, hour) => ({
      hour,
      count,
    }));

    // Peak days (histogram by day of week)
    const dayCounts = new Array(7).fill(0); // 0 = Sunday, 6 = Saturday
    requests.forEach((req) => {
      const day = req.createdAt.getDay();
      dayCounts[day]++;
    });
    const peakDays = dayCounts.map((count, day) => ({
      day,
      dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day],
      count,
    }));

    // Cancellation/reactivate counts
    const cancellationCount = requests.filter((req) => req.status === PrismaBookingStatus.CANCELED).length;
    const reactivateCount = requests.reduce((sum, req) => {
      return sum + req.auditLogs.filter((log) => log.action === "reactivate").length;
    }, 0);

    // Format response
    const metrics = {
      range,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totalRequests,
      requestsByStatus,
      conversionRate: Math.round(conversionRate * 100) / 100, // Round to 2 decimal places
      medianTimeToFirstResponse: medianTimeToFirstResponse 
        ? Math.round(medianTimeToFirstResponse / (1000 * 60)) // Convert to minutes
        : null,
      medianTimeToApproval: medianTimeToApproval
        ? Math.round(medianTimeToApproval / (1000 * 60)) // Convert to minutes
        : null,
      servicePopularity,
      peakHours,
      peakDays,
      cancellationCount,
      reactivateCount,
    };

    return apiSuccessResponse(metrics);
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code =
        error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

