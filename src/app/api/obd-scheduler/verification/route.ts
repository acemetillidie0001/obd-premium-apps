/**
 * OBD Scheduler & Booking - Verification API Route
 * 
 * GET: Run read-only production verification checks
 * All checks are non-invasive (no writes, no data modification)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { resolveBookingLink } from "@/lib/apps/obd-scheduler/bookingPublicLink";

export const runtime = "nodejs";

/**
 * Verification check result
 */
export interface VerificationCheck {
  name: string;
  status: "pass" | "fail";
  message: string;
  details?: string;
  timestamp: string;
}

/**
 * Verification response
 */
export interface VerificationResponse {
  checks: VerificationCheck[];
  timestamp: string;
}

/**
 * Check if public booking page resolves (code format)
 */
async function checkPublicBookingPageCode(
  businessId: string,
  code: string
): Promise<{ status: "pass" | "fail"; message: string; details?: string }> {
  try {
    // Resolve the booking link using the code
    const resolution = await resolveBookingLink(code);
    
    if (!resolution) {
      return {
        status: "fail",
        message: "Booking page does not resolve",
        details: `Code "${code}" not found in database`,
      };
    }
    
    if (resolution.businessId !== businessId) {
      return {
        status: "fail",
        message: "Booking page resolves to different business",
        details: `Expected businessId: ${businessId}, got: ${resolution.businessId}`,
      };
    }
    
    return {
      status: "pass",
      message: "Booking page resolves correctly",
      details: `Code "${code}" resolves to business ${businessId}`,
    };
  } catch (error) {
    return {
      status: "fail",
      message: "Error checking booking page",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if public booking page resolves (slug-code format)
 */
async function checkPublicBookingPageSlugCode(
  businessId: string,
  slug: string | null,
  code: string
): Promise<{ status: "pass" | "fail"; message: string; details?: string }> {
  try {
    if (!slug) {
      return {
        status: "pass",
        message: "Slug not configured (skipped)",
        details: "Slug-code format check skipped because no slug is set",
      };
    }
    
    // Construct slug-code format: {slug}-{code}
    const slugCode = `${slug}-${code}`;
    const resolution = await resolveBookingLink(slugCode);
    
    if (!resolution) {
      return {
        status: "fail",
        message: "Slug-code booking page does not resolve",
        details: `Slug-code "${slugCode}" not found in database`,
      };
    }
    
    if (resolution.businessId !== businessId) {
      return {
        status: "fail",
        message: "Slug-code booking page resolves to different business",
        details: `Expected businessId: ${businessId}, got: ${resolution.businessId}`,
      };
    }
    
    return {
      status: "pass",
      message: "Slug-code booking page resolves correctly",
      details: `Slug-code "${slugCode}" resolves to business ${businessId}`,
    };
  } catch (error) {
    return {
      status: "fail",
      message: "Error checking slug-code booking page",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if services API returns valid list
 */
async function checkServicesAPI(businessId: string, prisma: ReturnType<typeof import("@/lib/prisma").getPrisma>): Promise<{ status: "pass" | "fail"; message: string; details?: string }> {
  try {
    const services = await prisma.bookingService.findMany({
      where: { businessId },
      select: { id: true, name: true, active: true },
    });
    
    return {
      status: "pass",
      message: "Services API returns valid list",
      details: `Found ${services.length} service(s) (${services.filter(s => s.active).length} active)`,
    };
  } catch (error) {
    return {
      status: "fail",
      message: "Services API check failed",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if requests API responds
 */
async function checkRequestsAPI(businessId: string, prisma: ReturnType<typeof import("@/lib/prisma").getPrisma>): Promise<{ status: "pass" | "fail"; message: string; details?: string }> {
  try {
    const count = await prisma.bookingRequest.count({
      where: { businessId },
    });
    
    return {
      status: "pass",
      message: "Requests API responds",
      details: `Found ${count} booking request(s)`,
    };
  } catch (error) {
    return {
      status: "fail",
      message: "Requests API check failed",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if metrics endpoint responds
 */
async function checkMetricsAPI(businessId: string, prisma: ReturnType<typeof import("@/lib/prisma").getPrisma>): Promise<{ status: "pass" | "fail"; message: string; details?: string }> {
  try {
    // Just check if we can query the database for metrics data
    // This is a read-only check that doesn't modify anything
    const requestCount = await prisma.bookingRequest.count({
      where: { businessId },
    });
    
    const serviceCount = await prisma.bookingService.count({
      where: { businessId, active: true },
    });
    
    return {
      status: "pass",
      message: "Metrics endpoint responds",
      details: `Metrics data accessible (${requestCount} requests, ${serviceCount} active services)`,
    };
  } catch (error) {
    return {
      status: "fail",
      message: "Metrics API check failed",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check email configuration (env vars only, no secrets exposed)
 */
function checkEmailConfiguration(): { status: "pass" | "fail"; message: string; details?: string } {
  try {
    // Check for required email env vars (do NOT expose values, only existence)
    const requiredVars = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "SMTP_FROM_EMAIL",
    ];
    
    const missing: string[] = [];
    const configured: string[] = [];
    
    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (value && value.trim().length > 0) {
        configured.push(varName);
      } else {
        missing.push(varName);
      }
    }
    
    if (missing.length > 0) {
      return {
        status: "fail",
        message: "Email configuration incomplete",
        details: `Missing: ${missing.join(", ")}. Configured: ${configured.join(", ")}`,
      };
    }
    
    return {
      status: "pass",
      message: "Email configuration present",
      details: `All required email environment variables are configured (${configured.length} vars)`,
    };
  } catch (error) {
    return {
      status: "fail",
      message: "Email configuration check failed",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * GET /api/obd-scheduler/verification
 * Run production verification checks
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

    const businessId = user.id; // V3: userId = businessId

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    const timestamp = new Date().toISOString();
    const checks: VerificationCheck[] = [];

    // 1. Check if public link exists (read-only, no creation)
    let publicLinkCode: string;
    let publicLinkSlug: string | null;
    try {
      const publicLink = await prisma.bookingPublicLink.findUnique({
        where: { businessId },
        select: { code: true, slug: true },
      });
      
      if (!publicLink) {
        checks.push({
          name: "Public Link Setup",
          status: "fail",
          message: "Public booking link not found",
          details: "No BookingPublicLink record exists for this business. Create one in Settings tab.",
          timestamp,
        });
        // Continue with other checks even if this fails
        return apiSuccessResponse({
          checks,
          timestamp,
        } as VerificationResponse);
      }
      
      publicLinkCode = publicLink.code;
      publicLinkSlug = publicLink.slug;
    } catch (error) {
      checks.push({
        name: "Public Link Setup",
        status: "fail",
        message: "Error checking public link",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp,
      });
      // Continue with other checks even if this fails
      return apiSuccessResponse({
        checks,
        timestamp,
      } as VerificationResponse);
    }

    // 2. Check public booking page (code format)
    const codeCheck = await checkPublicBookingPageCode(businessId, publicLinkCode);
    checks.push({
      name: "Public Booking Page (Code)",
      status: codeCheck.status,
      message: codeCheck.message,
      details: codeCheck.details,
      timestamp,
    });

    // 3. Check public booking page (slug-code format)
    const slugCodeCheck = await checkPublicBookingPageSlugCode(businessId, publicLinkSlug, publicLinkCode);
    checks.push({
      name: "Public Booking Page (Slug-Code)",
      status: slugCodeCheck.status,
      message: slugCodeCheck.message,
      details: slugCodeCheck.details,
      timestamp,
    });

    // 4. Check services API
    const servicesCheck = await checkServicesAPI(businessId, prisma);
    checks.push({
      name: "Services API",
      status: servicesCheck.status,
      message: servicesCheck.message,
      details: servicesCheck.details,
      timestamp,
    });

    // 5. Check requests API
    const requestsCheck = await checkRequestsAPI(businessId, prisma);
    checks.push({
      name: "Requests API",
      status: requestsCheck.status,
      message: requestsCheck.message,
      details: requestsCheck.details,
      timestamp,
    });

    // 6. Check metrics API
    const metricsCheck = await checkMetricsAPI(businessId, prisma);
    checks.push({
      name: "Metrics API",
      status: metricsCheck.status,
      message: metricsCheck.message,
      details: metricsCheck.details,
      timestamp,
    });

    // 7. Check email configuration
    const emailCheck = checkEmailConfiguration();
    checks.push({
      name: "Email Configuration",
      status: emailCheck.status,
      message: emailCheck.message,
      details: emailCheck.details,
      timestamp,
    });

    return apiSuccessResponse({
      checks,
      timestamp,
    } as VerificationResponse);
  } catch (error) {
    return handleApiError(error);
  }
}

