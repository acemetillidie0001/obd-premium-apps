/**
 * Suite Onboarding Status API (deterministic aggregator)
 *
 * GET /api/onboarding/status
 *
 * - Business-scoped (membership-derived tenant context)
 * - Deterministic: derived from existing stored data only (no automation, no external calls)
 * - Stable response shape (no nested "data" wrapper)
 */

import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, handleApiError } from "@/lib/api/errorHandler";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { extractBrandKitActiveSnapshot } from "@/lib/brand/brandKitSnapshot";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RequiredStepStatus = "not_started" | "in_progress" | "done";
type SchedulerStepStatus = "optional" | "in_progress" | "done";

type OnboardingStatusResponse = {
  ok: true;
  dismissed: boolean;
  dismissedAt: string | null;
  progress: {
    percent: number;
    completedRequired: number;
    totalRequired: number;
  };
  steps: Array<
    | { key: "brandKit"; title: "Brand Kit"; status: RequiredStepStatus; href: "/apps/brand-kit-builder" }
    | { key: "billing"; title: "Billing & Plan"; status: RequiredStepStatus; href: "/apps/billing-plan" }
    | { key: "scheduler"; title: "Scheduler (optional)"; status: SchedulerStepStatus; href: "/apps/obd-scheduler" }
    | { key: "crm"; title: "CRM"; status: RequiredStepStatus; href: "/apps/obd-crm" }
    | { key: "helpDesk"; title: "AI Help Desk"; status: RequiredStepStatus; href: "/apps/ai-help-desk" }
  >;
};

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function percentDone(completed: number, total: number): number {
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return 0;
  const p = Math.round((completed / total) * 100);
  return Math.max(0, Math.min(100, p));
}

export async function GET(request: NextRequest) {
  warnIfBusinessIdParamPresent(request);

  try {
    // Any ACTIVE member can view onboarding status (read-only).
    const { businessId } = await requirePermission("TEAMS_USERS", "VIEW");

    let prisma;
    try {
      prisma = getPrisma();
    } catch {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    // Dismissed state (best-effort; if table not migrated yet, treat as not dismissed)
    const dismissedAtPromise = (async (): Promise<Date | null> => {
      try {
        const row = await prisma.onboardingState.findUnique({
          where: { businessId },
          select: { onboardingDismissedAt: true },
        });
        return row?.onboardingDismissedAt ?? null;
      } catch {
        return null;
      }
    })();

    // Brand Kit completeness:
    // Business is the tenant key (V3 businessId == userId), so the brand profile is stored under userId=businessId.
    const brandProfilePromise = prisma.brandProfile.findUnique({
      where: { userId: businessId },
    });

    // Billing entitlement: derive from the oldest active OWNER membership (business-level).
    const ownerPremiumPromise = (async (): Promise<boolean> => {
      try {
        const owner = await prisma.businessUser.findFirst({
          where: { businessId, role: "OWNER", status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          select: { userId: true },
        });
        if (!owner?.userId) return false;
        const u = await prisma.user.findUnique({
          where: { id: owner.userId },
          select: { isPremium: true, role: true },
        });
        // Admin users implicitly have premium access in code; mirror that here.
        return !!u && (u.role === "admin" || u.isPremium === true);
      } catch {
        return false;
      }
    })();

    // Scheduler readiness (same sources as GET /api/obd-scheduler/access; no external calls)
    const schedulerPromise = (async () => {
      const activationAllowed = isSchedulerPilotAllowed(businessId);
      const pilotMode =
        process.env.OBD_SCHEDULER_PILOT_MODE === "true" || process.env.OBD_SCHEDULER_PILOT_MODE === "1";
      const isPilot = pilotMode && !activationAllowed;
      const isEnabled = !isPilot;

      const [servicesCount, enabledAvailabilityWindowsCount, busyBlocksCount] = await Promise.all([
        prisma.bookingService.count({ where: { businessId } }),
        prisma.availabilityWindow.count({ where: { businessId, isEnabled: true } }),
        prisma.schedulerBusyBlock.count({ where: { businessId } }),
      ]);

      const hasAvailability = enabledAvailabilityWindowsCount > 0 || busyBlocksCount > 0;
      return { isEnabled, servicesCount, hasAvailability };
    })();

    // CRM + Help Desk completion counts
    const crmContactsCountPromise = prisma.crmContact.count({ where: { businessId } });
    const helpDeskEntriesCountPromise = prisma.aiHelpDeskEntry.count({
      where: { businessId, isActive: true },
    });

    const [dismissedAt, brandProfile, ownerPremium, scheduler, contactsCount, knowledgeEntriesCount] =
      await Promise.all([
        dismissedAtPromise,
        brandProfilePromise,
        ownerPremiumPromise,
        schedulerPromise,
        crmContactsCountPromise,
        helpDeskEntriesCountPromise,
      ]);

    const dismissedAtISO = toIsoOrNull(dismissedAt);
    const dismissed = dismissedAtISO !== null;

    // Step: Brand Kit
    const snapshot = extractBrandKitActiveSnapshot(brandProfile);
    const brandKitHasMinimum = !!(snapshot.businessName && snapshot.primaryColor);
    const brandKitStatus: RequiredStepStatus = !brandProfile
      ? "not_started"
      : brandKitHasMinimum
        ? "done"
        : "in_progress";

    // Step: Billing & Plan
    const billingStatus: RequiredStepStatus = ownerPremium ? "done" : "not_started";

    // Step: Scheduler (optional)
    const schedulerStatus: SchedulerStepStatus = !scheduler.isEnabled
      ? "optional"
      : scheduler.servicesCount > 0 && scheduler.hasAvailability
        ? "done"
        : scheduler.servicesCount > 0 || scheduler.hasAvailability
          ? "in_progress"
          : "optional";

    // Step: CRM
    const crmStatus: RequiredStepStatus = contactsCount > 0 ? "done" : "not_started";

    // Step: AI Help Desk
    const helpDeskStatus: RequiredStepStatus = knowledgeEntriesCount > 0 ? "done" : "not_started";

    const requiredStatuses: RequiredStepStatus[] = [brandKitStatus, billingStatus, crmStatus, helpDeskStatus];
    const totalRequired = requiredStatuses.length;
    const completedRequired = requiredStatuses.filter((s) => s === "done").length;

    const response: OnboardingStatusResponse = {
      ok: true,
      dismissed,
      dismissedAt: dismissedAtISO,
      progress: {
        percent: percentDone(completedRequired, totalRequired),
        completedRequired,
        totalRequired,
      },
      steps: [
        { key: "brandKit", title: "Brand Kit", status: brandKitStatus, href: "/apps/brand-kit-builder" },
        { key: "billing", title: "Billing & Plan", status: billingStatus, href: "/apps/billing-plan" },
        { key: "scheduler", title: "Scheduler (optional)", status: schedulerStatus, href: "/apps/obd-scheduler" },
        { key: "crm", title: "CRM", status: crmStatus, href: "/apps/obd-crm" },
        { key: "helpDesk", title: "AI Help Desk", status: helpDeskStatus, href: "/apps/ai-help-desk" },
      ],
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

