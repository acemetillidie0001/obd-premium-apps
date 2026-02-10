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
import { requireBusinessContext } from "@/lib/auth/requireBusinessContext";
import { warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { extractBrandKitActiveSnapshot } from "@/lib/brand/brandKitSnapshot";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RequiredStepStatus = "not_started" | "in_progress" | "done";
type SchedulerStepStatus = "optional" | "in_progress" | "done";
type UnknownStepStatus = "unknown";

type OnboardingStatusFailStage =
  | "business_context"
  | "onboarding_state"
  | "brand_kit"
  | "billing"
  | "scheduler"
  | "crm"
  | "help_desk";

type OnboardingStatusResponse = {
  ok: true;
  needsBusinessContext?: boolean;
  dismissed: boolean;
  dismissedAt: string | null;
  progress: {
    percent: number;
    completedRequired: number;
    totalRequired: number;
  };
  steps: Array<{
    key: "brandKit" | "billing" | "crm" | "helpDesk" | "scheduler";
    /**
     * Back-compat with existing UI.
     */
    title: string;
    /**
     * Requested by diagnostics prompt; safe metadata only.
     */
    label: string;
    required: boolean;
    status: RequiredStepStatus | SchedulerStepStatus | UnknownStepStatus;
    href:
      | "/apps/brand-kit-builder"
      | "/apps/billing-plan"
      | "/apps/obd-scheduler"
      | "/apps/obd-crm"
      | "/apps/ai-help-desk";
  }>;
};

type OnboardingStatusUnavailableResponse = {
  ok: false;
  unavailable: true;
  reason: "backend_unavailable";
  code: "ONBOARDING_STATUS_FAIL";
  stage: OnboardingStatusFailStage;
};

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function percentDone(completed: number, total: number): number {
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return 0;
  const p = Math.round((completed / total) * 100);
  return Math.max(0, Math.min(100, p));
}

function fallbackUnavailable(stage: OnboardingStatusFailStage, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error("[onboarding-status]", stage, msg);
  const response: OnboardingStatusUnavailableResponse = {
    ok: false,
    unavailable: true,
    reason: "backend_unavailable",
    code: "ONBOARDING_STATUS_FAIL",
    stage,
  };
  return NextResponse.json(response, { status: 200 });
}

function needsBusinessContextResponse(): OnboardingStatusResponse {
  return {
    ok: true,
    needsBusinessContext: true,
    dismissed: false,
    dismissedAt: null,
    progress: { percent: 0, completedRequired: 0, totalRequired: 4 },
    steps: [
      {
        key: "brandKit",
        title: "Brand Kit",
        label: "Brand Kit",
        required: true,
        status: "unknown",
        href: "/apps/brand-kit-builder",
      },
      {
        key: "billing",
        title: "Billing & Plan",
        label: "Billing & Plan",
        required: true,
        status: "unknown",
        href: "/apps/billing-plan",
      },
      {
        key: "crm",
        title: "CRM",
        label: "CRM",
        required: true,
        status: "unknown",
        href: "/apps/obd-crm",
      },
      {
        key: "helpDesk",
        title: "AI Help Desk",
        label: "AI Help Desk",
        required: true,
        status: "unknown",
        href: "/apps/ai-help-desk",
      },
      {
        key: "scheduler",
        title: "Scheduler (optional)",
        label: "Scheduler (optional)",
        required: false,
        status: "unknown",
        href: "/apps/obd-scheduler",
      },
    ],
  };
}

export async function GET(request: NextRequest) {
  warnIfBusinessIdParamPresent(request);

  try {
    // Any ACTIVE member can view onboarding status (read-only).
    // Do NOT gate this behind a specific app permission; onboarding is suite-level guidance.
    let businessId: string;
    try {
      ({ businessId } = await requireBusinessContext());
      if (!businessId || typeof businessId !== "string" || businessId.trim().length === 0) {
        console.warn("[onboarding-status] missing business context");
        return NextResponse.json(needsBusinessContextResponse(), { status: 200 });
      }
    } catch (error) {
      console.warn("[onboarding-status] missing business context");
      return NextResponse.json(needsBusinessContextResponse(), { status: 200 });
    }

    let prisma;
    try {
      prisma = getPrisma();
    } catch (error) {
      return fallbackUnavailable("onboarding_state", error);
    }

    // Dismissed state (best-effort; if table not migrated yet, treat as not dismissed)
    let dismissedAt: Date | null = null;
    try {
      const row = await prisma.onboardingState.findUnique({
        where: { businessId },
        select: { onboardingDismissedAt: true },
      });
      dismissedAt = row?.onboardingDismissedAt ?? null;
    } catch (error) {
      return fallbackUnavailable("onboarding_state", error);
    }

    // Brand Kit completeness:
    // Business is the tenant key (V3 businessId == userId), so the brand profile is stored under userId=businessId.
    let brandProfile: any = null;
    try {
      brandProfile = await prisma.brandProfile.findUnique({
        where: { userId: businessId },
      });
    } catch (error) {
      return fallbackUnavailable("brand_kit", error);
    }

    // Billing entitlement: derive from the oldest active OWNER membership (business-level).
    let ownerPremium = false;
    try {
      const owner = await prisma.businessUser.findFirst({
        where: { businessId, role: "OWNER", status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      });
      if (!owner?.userId) {
        ownerPremium = false;
      } else {
        const u = await prisma.user.findUnique({
          where: { id: owner.userId },
          select: { isPremium: true, role: true },
        });
        // Admin users implicitly have premium access in code; mirror that here.
        ownerPremium = !!u && (u.role === "admin" || u.isPremium === true);
      }
    } catch (error) {
      return fallbackUnavailable("billing", error);
    }

    // Scheduler readiness (same sources as GET /api/obd-scheduler/access; no external calls)
    let scheduler: { isEnabled: boolean; servicesCount: number; hasAvailability: boolean } = {
      isEnabled: false,
      servicesCount: 0,
      hasAvailability: false,
    };
    try {
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
      scheduler = { isEnabled, servicesCount, hasAvailability };
    } catch (error) {
      return fallbackUnavailable("scheduler", error);
    }

    // CRM + Help Desk completion counts
    let contactsCount = 0;
    try {
      contactsCount = await prisma.crmContact.count({ where: { businessId } });
    } catch (error) {
      return fallbackUnavailable("crm", error);
    }

    let knowledgeEntriesCount = 0;
    try {
      knowledgeEntriesCount = await prisma.aiHelpDeskEntry.count({
        where: { businessId, isActive: true },
      });
    } catch (error) {
      return fallbackUnavailable("help_desk", error);
    }

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
        {
          key: "brandKit",
          title: "Brand Kit",
          label: "Brand Kit",
          required: true,
          status: brandKitStatus,
          href: "/apps/brand-kit-builder",
        },
        {
          key: "billing",
          title: "Billing & Plan",
          label: "Billing & Plan",
          required: true,
          status: billingStatus,
          href: "/apps/billing-plan",
        },
        {
          key: "scheduler",
          title: "Scheduler (optional)",
          label: "Scheduler (optional)",
          required: false,
          status: schedulerStatus,
          href: "/apps/obd-scheduler",
        },
        {
          key: "crm",
          title: "CRM",
          label: "CRM",
          required: true,
          status: crmStatus,
          href: "/apps/obd-crm",
        },
        {
          key: "helpDesk",
          title: "AI Help Desk",
          label: "AI Help Desk",
          required: true,
          status: helpDeskStatus,
          href: "/apps/ai-help-desk",
        },
      ],
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return fallbackUnavailable("onboarding_state", error);
  }
}

