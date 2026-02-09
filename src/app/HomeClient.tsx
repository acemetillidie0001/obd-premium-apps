"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { OBD_APPS, AppCategory } from "@/lib/obd-framework/apps.config";
import { getAppIcon } from "@/lib/obd-framework/app-icons";
import { getAppPreview } from "@/lib/obd-framework/app-previews";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { normalizeAppHrefForPathname } from "@/lib/routing/appBasePaths";

const DASHBOARD_SECTIONS: { id: AppCategory; title: string; tagline: string }[] = [
  { id: "content", title: "Content & Writing Tools", tagline: "Create descriptions, posts, FAQs, and content tailored to Ocala customers." },
  { id: "reputation", title: "Reputation & Reviews", tagline: "Protect and grow your reputation with thoughtful, on-brand responses." },
  { id: "google", title: "Google Business & Local Search", tagline: "Audit and improve how your business appears when locals search in Ocala." },
  { id: "seo", title: "SEO Tools", tagline: "Plan smarter pages and structure so search engines understand—and reward—your business." },
  { id: "productivity", title: "Productivity & Automation", tagline: "Save time with systems that schedule, follow up, and move your business forward." },
  { id: "branding", title: "Design & Branding", tagline: "Clarify your visual identity so every touchpoint feels premium and consistent." },
];

type SchedulerAccessSnapshot = {
  isEnabled: boolean;
  setup: {
    servicesCount: number;
    hasAvailability: boolean;
  };
};

type SchedulerBadgeState = "activation_pending" | "ready_to_activate" | "ready" | "checking";

type OnboardingStepStatus = "not_started" | "in_progress" | "done" | "optional";

type OnboardingStatusResponse = {
  ok: true;
  dismissed: boolean;
  dismissedAt: string | null;
  progress: { percent: number; completedRequired: number; totalRequired: number };
  steps: Array<{
    key: "brandKit" | "billing" | "scheduler" | "crm" | "helpDesk";
    title: string;
    status: OnboardingStepStatus;
    href: string;
  }>;
};

type OnboardingDismissResponse = {
  ok: true;
  dismissed: boolean;
  dismissedAt: string | null;
};

const ONBOARDING_STEP_DESCRIPTIONS: Record<
  "brandKit" | "billing" | "scheduler" | "crm" | "helpDesk",
  string
> = {
  brandKit: "Add your business name and core brand colors once, then reuse them everywhere.",
  billing: "Confirm your plan so premium tools stay enabled for your business.",
  scheduler: "Add a service and availability if you want to accept bookings (optional).",
  crm: "Create your first contact to start tracking customers and follow-ups.",
  helpDesk: "Add at least one knowledge entry so the Help Desk has something to answer from.",
};

export default function HomeClient() {
  const pathname = usePathname();
  const { theme, isDark, toggleTheme } = useOBDTheme();

  const [schedulerBadgeState, setSchedulerBadgeState] = useState<SchedulerBadgeState>("checking");
  const [onboarding, setOnboarding] = useState<OnboardingStatusResponse | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingCollapsed, setOnboardingCollapsed] = useState(false);

  const getStartedHighlightTimeoutRef = useRef<number | null>(null);
  const getStartedRetryTimeoutRef = useRef<number | null>(null);
  const lastGetStartedHighlightedElRef = useRef<HTMLElement | null>(null);

  const schedulerBadgeLabel = useMemo(() => {
    switch (schedulerBadgeState) {
      case "activation_pending":
        return "Activation pending";
      case "ready_to_activate":
        return "Ready to activate";
      case "ready":
        return "Ready";
      case "checking":
      default:
        return "…";
    }
  }, [schedulerBadgeState]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/obd-scheduler/access");
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok || !json?.data) return;

        const snap = json.data as SchedulerAccessSnapshot;
        const next: SchedulerBadgeState =
          snap.isEnabled === false
            ? "activation_pending"
            : snap.setup.servicesCount === 0 || snap.setup.hasAvailability === false
              ? "ready_to_activate"
              : "ready";

        if (!cancelled) setSchedulerBadgeState(next);
      } catch {
        // Ignore — badge stays in "checking" state.
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Local-only UI preference: collapse/expand onboarding guide
    try {
      const raw = window.localStorage.getItem("obd:onboardingGuideCollapsed");
      if (raw === "1" || raw === "true") setOnboardingCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("obd:onboardingGuideCollapsed", onboardingCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [onboardingCollapsed]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setOnboardingLoading(true);
      try {
        const res = await fetch("/api/onboarding/status", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as unknown;
        if (!cancelled && res.ok && json && typeof json === "object" && (json as any).ok === true) {
          setOnboarding(json as OnboardingStatusResponse);
        }
      } catch {
        // Non-blocking: if it fails, we just don't show the panel.
      } finally {
        if (!cancelled) setOnboardingLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const HIGHLIGHT_CLASSES = [
      "ring-2",
      "ring-[#29c4a9]/35",
      "ring-offset-2",
      "ring-offset-white",
      "dark:ring-offset-slate-900",
      "shadow-[0_0_0_10px_rgba(41,196,169,0.10)]",
      "transition-shadow",
      "duration-300",
    ];

    const clearHighlight = () => {
      if (getStartedHighlightTimeoutRef.current != null) {
        window.clearTimeout(getStartedHighlightTimeoutRef.current);
        getStartedHighlightTimeoutRef.current = null;
      }
      if (lastGetStartedHighlightedElRef.current) {
        lastGetStartedHighlightedElRef.current.classList.remove(...HIGHLIGHT_CLASSES);
        lastGetStartedHighlightedElRef.current = null;
      }
    };

    const scrollAndHighlightGetStarted = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash !== "#get-started") return;

      if (getStartedRetryTimeoutRef.current != null) {
        window.clearTimeout(getStartedRetryTimeoutRef.current);
        getStartedRetryTimeoutRef.current = null;
      }

      let attempts = 0;
      const tryOnce = () => {
        attempts += 1;

        const anchor = document.getElementById("get-started");
        if (!anchor) {
          if (attempts < 10) {
            getStartedRetryTimeoutRef.current = window.setTimeout(tryOnce, 100);
          }
          return;
        }

        anchor.scrollIntoView({ behavior: "smooth", block: "start" });

        // Prefer the visible panel (or dismissed link area) so the ring looks "attached" to UI.
        const highlightTarget =
          (document.querySelector('[data-get-started-highlight="true"]') as HTMLElement | null) ??
          anchor;

        clearHighlight();
        highlightTarget.classList.add(...HIGHLIGHT_CLASSES);
        lastGetStartedHighlightedElRef.current = highlightTarget;
        getStartedHighlightTimeoutRef.current = window.setTimeout(() => {
          highlightTarget.classList.remove(...HIGHLIGHT_CLASSES);
          if (lastGetStartedHighlightedElRef.current === highlightTarget) {
            lastGetStartedHighlightedElRef.current = null;
          }
          getStartedHighlightTimeoutRef.current = null;
        }, 900);
      };

      tryOnce();
    };

    // Initial load: hash may already be present before content renders.
    scrollAndHighlightGetStarted();
    window.addEventListener("hashchange", scrollAndHighlightGetStarted);

    return () => {
      window.removeEventListener("hashchange", scrollAndHighlightGetStarted);
      if (getStartedRetryTimeoutRef.current != null) {
        window.clearTimeout(getStartedRetryTimeoutRef.current);
        getStartedRetryTimeoutRef.current = null;
      }
      clearHighlight();
    };
    // Re-run after onboarding loads so we can highlight the real panel (or dismissed link)
    // instead of a placeholder container.
  }, [onboardingLoading, onboarding?.dismissed]);

  const statusPill = (status: OnboardingStepStatus) => {
    const base =
      "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap";
    if (status === "done") {
      return (
        <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200`}>
          Done
        </span>
      );
    }
    if (status === "in_progress") {
      return (
        <span className={`${base} border-[#29c4a9]/30 bg-[#29c4a9]/10 text-[#1f8f7d] dark:border-[#29c4a9]/40 dark:bg-[#29c4a9]/10 dark:text-[#29c4a9]`}>
          In progress
        </span>
      );
    }
    if (status === "optional") {
      return (
        <span className={`${base} border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300`}>
          Optional
        </span>
      );
    }
    return (
      <span className={`${base} border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900/20 dark:text-slate-200`}>
        Not started
      </span>
    );
  };

  const setDismissed = async (dismissed: boolean) => {
    setOnboardingSaving(true);
    try {
      const res = await fetch("/api/onboarding/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed }),
      });
      const json = (await res.json().catch(() => null)) as unknown;
      if (!res.ok || !json || typeof json !== "object" || (json as any).ok !== true) return;
      const next = json as OnboardingDismissResponse;

      setOnboarding((prev) => {
        if (!prev) return prev;
        return { ...prev, dismissed: next.dismissed, dismissedAt: next.dismissedAt };
      });
    } finally {
      setOnboardingSaving(false);
    }
  };

  const pageBg = isDark ? "bg-slate-950" : "bg-slate-50";
  const panelBg = isDark ? "bg-gradient-to-b from-slate-900/95 to-slate-950" : "bg-white";
  const mutedText = isDark ? "text-slate-300" : "text-slate-600";
  const cardBgLive = isDark ? "bg-slate-900/80 border-slate-800 shadow-lg shadow-slate-950/60 text-slate-50" : "bg-white border-slate-200 shadow-lg shadow-slate-200 text-slate-900";
  const cardBgNonLive = isDark ? "bg-slate-900/80 border-slate-800 shadow-md shadow-slate-950/40 text-slate-50 opacity-90" : "bg-white border-slate-200 shadow-md shadow-slate-200/50 text-slate-900 opacity-90";
  const schedulerChipClasses = useMemo(() => {
    const base =
      "inline-flex min-w-[140px] items-center justify-center rounded-full border px-3 py-1 text-[11px] font-medium whitespace-nowrap";
    if (schedulerBadgeState === "ready") {
      return `${base} ${
        isDark ? "border-green-700 bg-green-900/20 text-green-200" : "border-green-200 bg-green-50 text-green-700"
      }`;
    }
    if (schedulerBadgeState === "ready_to_activate") {
      return `${base} ${
        isDark ? "border-[#29c4a9]/40 bg-[#29c4a9]/10 text-[#29c4a9]" : "border-[#29c4a9]/50 bg-[#29c4a9]/10 text-[#1f8f7d]"
      }`;
    }
    // activation_pending or checking
    return `${base} ${
      isDark ? "border-slate-700 bg-slate-900/30 text-slate-200" : "border-slate-200 bg-white text-slate-700"
    }`;
  }, [isDark, schedulerBadgeState]);

  return (
    <main className={`w-full min-h-screen transition-colors ${pageBg}`}>
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#29c4a9] mb-1">
          Part of OBD Premium Features
        </p>
        <h1
          className={`text-4xl font-bold mb-2 obd-heading ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          OBD Premium Dashboard
        </h1>
        <p className={`max-w-2xl mb-10 obd-soft-text ${mutedText}`}>
          Access all your Ocala-focused AI business tools in one place.
        </p>
        
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={toggleTheme}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium shadow-sm transition ${
              isDark
                ? "border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-800"
                : "border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: isDark ? "#29c4a9" : "#29c4a9" }}
            />
            {isDark ? "Dark Mode On — Switch to Light" : "Light Mode On — Switch to Dark"}
          </button>
        </div>

        <section
          className={`mt-8 rounded-3xl p-6 md:p-8 transition-colors ${panelBg}`}
        >
          <div className="space-y-16">
            {/* Get Started anchor target (always present) */}
            <div id="get-started" className="scroll-mt-28">
              {/* Onboarding guide panel (non-blocking, dismissible) */}
              {onboardingLoading ? (
                <section
                  data-get-started-highlight="true"
                  className={`mt-7 rounded-2xl border p-5 shadow-sm ${
                    isDark
                      ? "border-slate-800 bg-slate-900/40 text-slate-100"
                      : "border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">Get started with OBD</div>
                      <div className={`mt-1 text-xs ${mutedText}`}>Loading setup guide…</div>
                    </div>
                    <div className={`text-xs ${mutedText}`}>…</div>
                  </div>
                </section>
              ) : null}

              {!onboardingLoading && onboarding?.ok && onboarding.dismissed === true ? (
                <div data-get-started-highlight="true" className="mt-7 inline-block rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setDismissed(false)}
                    disabled={onboardingSaving}
                    className={`text-sm font-medium hover:underline hover:underline-offset-2 disabled:opacity-60 ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    Show setup guide
                  </button>
                </div>
              ) : null}

              {!onboardingLoading && onboarding?.ok && onboarding.dismissed === false ? (
                <section
                  data-get-started-highlight="true"
                  className={`mt-7 rounded-2xl border p-6 shadow-sm ${
                    isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className={`text-xl font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Get started with OBD
                      </h2>
                      <p className={`mt-1 text-sm ${mutedText}`}>
                        Recommended steps to set up your tools. Nothing is automatic — you’re always in control.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setOnboardingCollapsed((v) => !v)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                          isDark
                            ? "border-slate-700 bg-slate-950/40 text-slate-200 hover:bg-slate-950/55"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {onboardingCollapsed ? "Expand" : "Collapse"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        disabled={onboardingSaving}
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                          isDark
                            ? "border-slate-700 bg-slate-950/25 text-slate-200 hover:bg-slate-950/40"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                        Setup progress: {onboarding.progress.percent}%
                      </div>
                      <div className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {onboarding.progress.completedRequired}/{onboarding.progress.totalRequired} required complete
                      </div>
                    </div>
                    <div className={`mt-2 h-2 w-full rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                      <div
                        className="h-2 rounded-full bg-[#29c4a9] transition-[width]"
                        style={{ width: `${Math.max(0, Math.min(100, onboarding.progress.percent))}%` }}
                      />
                    </div>
                  </div>

                  {/* Steps */}
                  {!onboardingCollapsed ? (
                    <div
                      className={`mt-6 divide-y rounded-xl border ${
                        isDark ? "divide-slate-800 border-slate-800" : "divide-slate-200 border-slate-200"
                      }`}
                    >
                      {onboarding.steps.map((step) => (
                        <div
                          key={step.key}
                          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                                {step.title}
                              </div>
                              {statusPill(step.status)}
                            </div>
                            <p className={`mt-1 text-sm ${mutedText}`}>
                              {ONBOARDING_STEP_DESCRIPTIONS[step.key]}
                            </p>
                          </div>
                          <div className="flex items-center justify-end">
                            <Link
                              href={step.href}
                              className="inline-flex items-center justify-center rounded-md bg-[#29c4a9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#24b09a]"
                            >
                              Open
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {!onboardingLoading && (!onboarding || onboarding.ok !== true) ? (
                <section
                  data-get-started-highlight="true"
                  className={`mt-7 rounded-2xl border p-5 shadow-sm ${
                    isDark
                      ? "border-slate-800 bg-slate-900/40 text-slate-100"
                      : "border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <div className="text-sm font-semibold">Get started with OBD</div>
                  <p className={`mt-1 text-xs ${mutedText}`}>
                    Setup guide is temporarily unavailable.
                  </p>
                </section>
              ) : null}
            </div>

            {/* My Account Section */}
            <div className="space-y-4 pt-6">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl" style={{ filter: "hue-rotate(140deg) saturate(1.2)" }}>
                    👤
                  </span>
                  <h2
                    className={`text-2xl font-bold obd-heading ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    My Account
                  </h2>
                </div>
                <p className={`text-sm ${mutedText} obd-soft-text`}>
                  Manage your business identity, plan, and team
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Brand Profile Card (ACTIVE) */}
                <Link
                  href="/brand-profile"
                  className={`relative flex h-full min-h-[200px] flex-col justify-between rounded-2xl border px-6 py-6 text-center transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl ${cardBgLive} group`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-center w-full">
                      <div className="flex-shrink-0 text-2xl">🎨</div>
                      <h3 className={`text-base font-semibold ${
                        isDark ? "text-slate-50" : "text-slate-900"
                      }`}>
                        Brand Profile
                      </h3>
                    </div>
                    <p className={`mt-1 text-sm ${
                      isDark ? "text-slate-300" : "text-slate-600"
                    }`}>
                      View and manage your saved brand identity used across all OBD AI tools.
                    </p>
                  </div>
                  <div className="mt-4">
                    <span className="inline-flex items-center justify-center rounded-full bg-[#29c4a9] px-6 py-2 text-sm font-semibold text-white hover:bg-[#22ad93] shadow-md shadow-[#29c4a9]/40 hover:shadow-lg hover:shadow-[#29c4a9]/60 transition">
                      View / Edit Brand Profile
                    </span>
                  </div>
                </Link>

                {/* Billing & Plan Card (ACTIVE) */}
                <Link
                  href="/billing-plan"
                  className={`relative flex h-full min-h-[200px] flex-col justify-between rounded-2xl border px-6 py-6 text-center transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl ${cardBgLive} group`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-center w-full">
                      <div className="flex-shrink-0 text-2xl">💳</div>
                      <h3
                        className={`text-base font-semibold ${
                          isDark ? "text-slate-50" : "text-slate-900"
                        }`}
                      >
                        Billing & Plan
                      </h3>
                    </div>
                    <p
                      className={`mt-1 text-sm ${
                        isDark ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      View your current plan and available billing options.
                    </p>
                  </div>
                  <div className="mt-4">
                    <span className="inline-flex items-center justify-center rounded-full bg-[#29c4a9] px-6 py-2 text-sm font-semibold text-white hover:bg-[#22ad93] shadow-md shadow-[#29c4a9]/40 hover:shadow-lg hover:shadow-[#29c4a9]/60 transition">
                      Manage Billing
                    </span>
                  </div>
                </Link>

                {/* Team & Users Card (ACTIVE) */}
                <Link
                  href="/teams-users"
                  className={`relative flex h-full min-h-[200px] flex-col justify-between rounded-2xl border px-6 py-6 text-center transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl ${cardBgLive} group`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-center w-full">
                      <div className="flex-shrink-0 text-2xl">👥</div>
                      <h3 className={`text-base font-semibold ${
                        isDark ? "text-slate-50" : "text-slate-900"
                      }`}>
                        Team & Users
                      </h3>
                    </div>
                    <p className={`mt-1 text-sm ${
                      isDark ? "text-slate-300" : "text-slate-600"
                    }`}>
                      Invite team members and control access to your business tools.
                    </p>
                  </div>
                  <div className="mt-4">
                    <span className="inline-flex items-center justify-center rounded-full bg-[#29c4a9] px-6 py-2 text-sm font-semibold text-white hover:bg-[#22ad93] shadow-md shadow-[#29c4a9]/40 hover:shadow-lg hover:shadow-[#29c4a9]/60 transition">
                      Open Tool
                    </span>
                  </div>
                </Link>
              </div>
            </div>

            {DASHBOARD_SECTIONS.map((section) => {
              const sectionApps = OBD_APPS.filter((app) => app.category === section.id);
              
              // Skip sections with no apps
              if (sectionApps.length === 0) return null;

              // Category icons (simple emoji placeholders matching OBD teal theme)
              const categoryIcons: Record<AppCategory, string> = {
                content: "✍️",
                reputation: "⭐",
                google: "🔍",
                seo: "📈",
                productivity: "⚡",
                branding: "🎨",
              };

              return (
                <div key={section.id} className="space-y-4 pt-6">
                  <div className="max-w-3xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl" style={{ filter: "hue-rotate(140deg) saturate(1.2)" }}>
                        {categoryIcons[section.id]}
                      </span>
                      <h2
                        className={`text-2xl font-bold obd-heading ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {section.title}
                      </h2>
                    </div>
                    <p className={`text-sm ${mutedText} obd-soft-text`}>
                      {section.tagline}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sectionApps.map((app) => {
                      const isLive = app.status === "live";
                      const isInProgress = app.status === "in-progress";
                      const isComingSoon = app.status === "coming-soon";
                      const hasHref = !!app.href;
                      const isNonLive = !isLive;
                      const isSchedulerCard = app.id === "scheduler-booking";

                      // Title with icon - centered
                      const TitleSection = (
                        <div className="flex items-center justify-center gap-2 text-center w-full">
                          {app.icon && getAppIcon(app.icon) && (
                            <div className="flex-shrink-0">
                              {getAppIcon(app.icon)}
                            </div>
                          )}
                          <div className="flex min-w-0 flex-col items-center gap-1">
                            <h3
                              className={`text-base font-semibold ${
                                isDark ? "text-slate-50" : "text-slate-900"
                              }`}
                            >
                              {app.name}
                            </h3>
                            {isSchedulerCard && (
                              <span className={schedulerChipClasses}>{schedulerBadgeLabel}</span>
                            )}
                          </div>
                        </div>
                      );

                      // Description - only show for live and in-progress apps (not coming-soon)
                      // For in-progress: visible but muted
                      // For coming-soon: completely removed
                      const DescriptionText = (isLive || isInProgress) ? (
                        <p 
                          className={`mt-1 text-sm line-clamp-2 ${
                            isInProgress 
                              ? (isDark ? "text-slate-400" : "text-slate-500")
                              : (isDark ? "text-slate-300" : "text-slate-600")
                          }`}
                        >
                          {app.description}
                        </p>
                      ) : null;

                      // CTA button section
                      const getButtonText = () => {
                        if (isLive) {
                          return app.ctaLabel || "Open Tool";
                        }
                        if (isComingSoon) {
                          return "Coming Q1 2026";
                        }
                        if (isInProgress) {
                          return app.ctaLabel || "In Development";
                        }
                        return "Coming Soon";
                      };

                      const CTASection = (
                        <div className="mt-4">
                          {isLive && hasHref ? (
                            <span
                              className="inline-flex items-center justify-center rounded-full bg-[#29c4a9] px-6 py-2 text-sm font-semibold text-white hover:bg-[#22ad93] shadow-md shadow-[#29c4a9]/40 hover:shadow-lg hover:shadow-[#29c4a9]/60 transition"
                            >
                              {getButtonText()}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled
                              aria-disabled="true"
                              className={`inline-flex items-center justify-center rounded-full border px-6 py-2 text-sm font-semibold cursor-not-allowed pointer-events-none transition-opacity ${
                                isInProgress
                                  ? `border-[#29c4a9]/40 bg-transparent ${isDark ? "text-slate-400" : "text-slate-500"} opacity-70`
                                  : `border-[#29c4a9]/50 bg-transparent ${isDark ? "text-slate-400" : "text-slate-600"} opacity-80`
                              }`}
                            >
                              {getButtonText()}
                            </button>
                          )}
                        </div>
                      );


                      // Subtle overlay for non-live apps - clean and premium, no harsh gradients
                      const GlassOverlay = isNonLive ? (
                        <div
                          className={`
                            pointer-events-none absolute inset-0 rounded-2xl
                            flex flex-col items-center justify-center
                            z-0
                            ${
                              isComingSoon
                                ? isDark
                                  ? "bg-slate-900/60"
                                  : "bg-slate-100/70"
                                : isDark
                                  ? "bg-slate-900/40"
                                  : "bg-slate-100/50"
                            }
                          `}
                        >
                          {/* Centered badge - only for in-progress apps */}
                          {isInProgress && (
                            <div className="relative z-20">
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                                isDark 
                                  ? "border-[#29c4a9]/50 bg-[#29c4a9]/10 text-[#29c4a9]"
                                  : "border-[#29c4a9]/60 bg-[#29c4a9]/10 text-[#29c4a9]"
                              }`}>
                                IN DEVELOPMENT
                              </span>
                            </div>
                          )}
                        </div>
                      ) : null;

                      // Get preview text for hover overlay
                      const previewText = getAppPreview(app.id);
                      const hasPreview = !!previewText;

                      if (isLive && hasHref) {
                        const resolvedHref = normalizeAppHrefForPathname(app.href!, pathname);
                        return (
                          <Link
                            key={app.id}
                            href={resolvedHref}
                            className={`relative flex h-full min-h-[200px] flex-col justify-between rounded-2xl border px-6 py-6 text-center transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl ${cardBgLive} group`}
                          >
                            <div className="space-y-2">
                              {TitleSection}
                              {DescriptionText && (
                                <div className="relative group/desc">
                                  {DescriptionText}
                                  {hasPreview && (
                                    <div className="absolute bottom-full left-1/2 z-[100] mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg opacity-0 transition-opacity duration-200 pointer-events-none group-hover/desc:opacity-100">
                                      {previewText}
                                      <div className="absolute top-full left-1/2 -mt-1 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {CTASection}
                          </Link>
                        );
                      }

                      // Parallax mouse tracking handler (no state needed - uses CSS variables directly)
                      const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
                        const target = e.currentTarget;
                        const rect = target.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        target.style.setProperty('--px', `${x}px`);
                        target.style.setProperty('--py', `${y}px`);
                      };

                      const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
                        e.currentTarget.style.setProperty('--px', '0px');
                        e.currentTarget.style.setProperty('--py', '0px');
                      };

                      // Get preview text for hover overlay
                      const previewTextNonLive = getAppPreview(app.id);
                      const hasPreviewNonLive = !!previewTextNonLive;

                      return (
                        <div
                          key={app.id}
                          onMouseMove={isNonLive ? handleMouseMove : undefined}
                          onMouseLeave={isNonLive ? handleMouseLeave : undefined}
                          className={`relative flex h-full min-h-[200px] flex-col justify-between rounded-2xl border px-6 py-6 text-center transition-shadow duration-200 hover:shadow-lg ${cardBgNonLive} ${isNonLive ? "nonLiveTile neonHoverBorder tileParallax tileFloat tileShimmer animatedBorder" : ""} group`}
                        >
                          {/* Luxury ribbon */}
                          {isNonLive && app.showRibbon && app.ribbonText && (
                            <div className="luxRibbon">
                              {app.ribbonText}
                            </div>
                          )}
                          
                          <div className="relative z-10 space-y-2">
                            {TitleSection}
                            {DescriptionText && (
                              <div className="relative group/desc">
                                {DescriptionText}
                                {hasPreviewNonLive && (
                                  <div className="absolute bottom-full left-1/2 z-[100] mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg opacity-0 transition-opacity duration-200 pointer-events-none group-hover/desc:opacity-100">
                                    {previewTextNonLive}
                                    <div className="absolute top-full left-1/2 -mt-1 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="relative z-10">
                            {CTASection}
                          </div>
                          {GlassOverlay}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Support & Learning (quiet, wide cards) */}
            <div className="space-y-4 pt-10">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl" style={{ filter: "hue-rotate(140deg) saturate(1.2)" }}>
                    🧭
                  </span>
                  <h2
                    className={`text-2xl font-bold obd-heading ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Support &amp; Learning
                  </h2>
                </div>
                <p className={`text-sm ${mutedText} obd-soft-text`}>
                  Find answers fast — or reach the team if you need human help.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Link
                  href="/help-center"
                  className={`relative flex h-full min-h-[220px] flex-col justify-between rounded-2xl border px-6 py-6 transition-shadow duration-200 hover:shadow-xl ${
                    isDark
                      ? "bg-slate-900/60 border-slate-800 shadow-lg shadow-slate-950/50 text-slate-50 hover:border-slate-700"
                      : "bg-white border-slate-200 shadow-lg shadow-slate-200/60 text-slate-900 hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-xl border flex items-center justify-center ${
                          isDark ? "bg-slate-800/60 border-slate-700" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <span className="text-xl leading-none">🧭</span>
                      </div>
                      <h3 className={`text-lg font-semibold leading-tight ${isDark ? "text-slate-50" : "text-slate-900"}`}>
                        Help Center
                      </h3>
                    </div>
                    <p className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      Search across OBD tools to understand how things work. Read-only. No changes made.
                    </p>
                  </div>

                  <div className="pt-6">
                    <span
                      className={`w-full inline-flex items-center justify-center rounded-full border px-6 py-2 text-sm font-semibold transition-colors ${
                        isDark
                          ? "border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-800/55"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      Open Help Center →
                    </span>
                  </div>
                </Link>

                <a
                  href="https://ocalabusinessdirectory.com/contact/"
                  className={`relative flex h-full min-h-[220px] flex-col justify-between rounded-2xl border px-6 py-6 transition-shadow duration-200 hover:shadow-xl ${
                    isDark
                      ? "bg-slate-900/60 border-slate-800 shadow-lg shadow-slate-950/50 text-slate-50 hover:border-slate-700"
                      : "bg-white border-slate-200 shadow-lg shadow-slate-200/60 text-slate-900 hover:border-slate-300"
                  }`}
                  rel="noreferrer"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-xl border flex items-center justify-center ${
                          isDark ? "bg-slate-800/60 border-slate-700" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <span className="text-xl leading-none">💬</span>
                      </div>
                      <h3 className={`text-lg font-semibold leading-tight ${isDark ? "text-slate-50" : "text-slate-900"}`}>
                        Contact Support
                      </h3>
                    </div>
                    <p className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      Need help from the team? Send a support request and we’ll point you in the right direction.
                    </p>
                  </div>

                  <div className="pt-6">
                    <span
                      className={`w-full inline-flex items-center justify-center rounded-full border px-6 py-2 text-sm font-semibold transition-colors ${
                        isDark
                          ? "border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-800/55"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      Open Support →
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

