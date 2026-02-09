"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import {
  User,
  CreditCard,
  Users,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  HelpCircle,
  Gift,
  Calendar,
  Briefcase,
  Star,
  BarChart3,
  Bot,
  MapPin,
  Search,
  Globe,
  FileCode,
  Database,
  TrendingUp,
  Zap,
  Clock,
  Building2,
  Palette,
  Sparkles,
} from "lucide-react";

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

interface AppTile {
  title: string;
  description: string;
  href?: string;
  buttonLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
}

interface AppSection {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tiles: AppTile[];
}

const APP_SECTIONS: AppSection[] = [
  {
    title: "My Account",
    description: "Manage your account settings and preferences",
    icon: User,
    tiles: [
      {
        title: "Brand Profile",
        description: "View and edit your brand identity and settings",
        href: "/apps/brand-profile",
        buttonLabel: "View / Edit Brand Profile",
        icon: User,
      },
      {
        title: "Billing & Plan",
        description: "Manage your subscription and billing information",
        buttonLabel: "Coming Soon",
        icon: CreditCard,
        comingSoon: true,
      },
      {
        title: "Team & Users",
        description: "Manage team members and user access",
        href: "/apps/teams-users",
        buttonLabel: "Open Tool",
        icon: Users,
        comingSoon: false,
      },
    ],
  },
  {
    title: "Content & Writing Tools",
    description: "Create compelling content for your business",
    icon: FileText,
    tiles: [
      {
        title: "AI Review Responder",
        description: "Generate professional responses to customer reviews",
        href: "/apps/review-responder",
        buttonLabel: "Write a Reply",
        icon: MessageSquare,
      },
      {
        title: "AI Business Description Writer",
        description: "Craft professional business descriptions",
        href: "/apps/business-description-writer",
        buttonLabel: "Create Description",
        icon: FileText,
      },
      {
        title: "AI Social Media Post Creator",
        description: "Create eye-catching social media posts",
        href: "/apps/social-media-post-creator",
        buttonLabel: "Create Posts",
        icon: ImageIcon,
      },
      {
        title: "AI FAQ Generator",
        description: "Create comprehensive FAQ sections",
        href: "/apps/faq-generator",
        buttonLabel: "Generate FAQs",
        icon: HelpCircle,
      },
      {
        title: "AI Content Writer",
        description: "Generate blog posts, service pages, and more",
        href: "/apps/content-writer",
        buttonLabel: "Start Writing",
        icon: FileText,
      },
      {
        title: "AI Image Caption Generator",
        description: "Generate engaging captions for images",
        href: "/apps/image-caption-generator",
        buttonLabel: "Write Captions",
        icon: ImageIcon,
      },
      {
        title: "Offers & Promotions Builder",
        description: "Create compelling promotional offers",
        href: "/apps/offers-builder",
        buttonLabel: "Create Promo",
        icon: Gift,
      },
      {
        title: "Event Campaign Builder",
        description: "Build engaging event marketing campaigns",
        href: "/apps/event-campaign-builder",
        buttonLabel: "Create Campaign",
        icon: Calendar,
      },
      {
        title: "Local Hiring Assistant",
        description: "Generate job postings and hiring content",
        href: "/apps/local-hiring-assistant",
        buttonLabel: "Open Tool",
        icon: Briefcase,
      },
    ],
  },
  {
    title: "Reputation & Reviews",
    description: "Manage and improve your online reputation",
    icon: Star,
    tiles: [
      {
        title: "Reputation Dashboard",
        description: "Monitor and analyze your online reviews",
        href: "/apps/reputation-dashboard",
        buttonLabel: "Open Dashboard",
        icon: BarChart3,
      },
      {
        title: "Review Request Automation",
        description: "Automatically request reviews from customers",
        href: "/apps/review-request-automation",
        buttonLabel: "Open Tool",
        icon: Bot,
      },
    ],
  },
  {
    title: "Google Business & Local Search",
    description: "Optimize your Google Business Profile and local presence",
    icon: MapPin,
    tiles: [
      {
        title: "Google Business Profile Pro",
        description: "Advanced Google Business Profile management",
        href: "/apps/google-business-pro",
        buttonLabel: "Open Tool",
        icon: Globe,
      },
      {
        title: "Local Keyword Research Tool",
        description: "Discover high-value local keywords",
        href: "/apps/local-keyword-research",
        buttonLabel: "Open Tool",
        icon: Search,
      },
    ],
  },
  {
    title: "SEO Tools",
    description: "Improve your search engine visibility",
    icon: TrendingUp,
    tiles: [
      {
        title: "Local SEO Page Builder",
        description: "Create optimized local landing pages",
        href: "/apps/local-seo-page-builder",
        buttonLabel: "Build SEO Page",
        icon: FileCode,
      },
      {
        title: "Business Schema Generator",
        description: "Generate structured data for your business",
        href: "/apps/business-schema-generator",
        buttonLabel: "Generate Schema",
        icon: Database,
      },
      {
        title: "SEO Audit & Roadmap",
        description: "Get a comprehensive SEO improvement plan",
        href: "/apps/seo-audit-roadmap",
        buttonLabel: "Run SEO Audit",
        icon: TrendingUp,
      },
    ],
  },
  {
    title: "Productivity & Automation",
    description: "Streamline your business operations",
    icon: Zap,
    tiles: [
      {
        title: "OBD Social Auto-Poster",
        description: "Automate social media posting",
        href: "/apps/social-auto-poster",
        buttonLabel: "Open Tool",
        icon: Zap,
      },
      {
        title: "OBD Scheduler & Booking",
        description: "Schedule appointments and manage bookings",
        href: "/apps/obd-scheduler",
        buttonLabel: "Open Scheduler",
        icon: Clock,
      },
      {
        title: "OBD CRM",
        description: "Manage customer relationships and contacts",
        href: "/apps/obd-crm",
        buttonLabel: "Open CRM",
        icon: Building2,
      },
      {
        title: "AI Help Desk",
        description: "Intelligent customer support automation",
        href: "/apps/ai-help-desk",
        buttonLabel: "Open Help Desk",
        icon: HelpCircle,
      },
    ],
  },
  {
    title: "Design & Branding",
    description: "Create stunning visuals and build your brand",
    icon: Palette,
    tiles: [
      {
        title: "AI Logo Generator",
        description: "Generate custom logos with AI",
        href: "/apps/ai-logo-generator",
        buttonLabel: "Generate Logos",
        icon: Sparkles,
      },
      {
        title: "Brand Kit Builder",
        description: "Create comprehensive brand guidelines",
        href: "/apps/brand-kit-builder",
        buttonLabel: "Build Brand Kit",
        icon: Palette,
      },
    ],
  },
];

export default function AppsLauncherClient() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";

  const [onboarding, setOnboarding] = useState<OnboardingStatusResponse | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingCollapsed, setOnboardingCollapsed] = useState(false);

  const getStartedHighlightTimeoutRef = useRef<number | null>(null);
  const lastGetStartedHighlightedElRef = useRef<HTMLElement | null>(null);

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

      const anchor = document.getElementById("get-started");
      if (!anchor) return;

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

    // Initial load: hash may already be present before content renders.
    scrollAndHighlightGetStarted();
    const raf = window.requestAnimationFrame(() => scrollAndHighlightGetStarted());
    const t = window.setTimeout(() => scrollAndHighlightGetStarted(), 60);

    // Subsequent navigations (e.g. /#get-started, or /apps#get-started in legacy/demo contexts).
    // Note: Next.js often uses history.pushState/replaceState which does NOT fire `hashchange`,
    // so we also emit a lightweight locationchange event when that happens.
    const LOCATION_CHANGE_EVENT = "obd:locationchange";
    const emitLocationChange = () => window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args as any);
      emitLocationChange();
    };
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args as any);
      emitLocationChange();
    };

    window.addEventListener("hashchange", scrollAndHighlightGetStarted);
    window.addEventListener("popstate", scrollAndHighlightGetStarted);
    window.addEventListener(LOCATION_CHANGE_EVENT, scrollAndHighlightGetStarted);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;

      window.removeEventListener("hashchange", scrollAndHighlightGetStarted);
      window.removeEventListener("popstate", scrollAndHighlightGetStarted);
      window.removeEventListener(LOCATION_CHANGE_EVENT, scrollAndHighlightGetStarted);
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
      clearHighlight();
    };
    // Re-run after onboarding loads so we can highlight the real panel (or dismissed link)
    // instead of an empty anchor container.
  }, [onboardingLoading, onboarding?.dismissed]);

  useEffect(() => {
    // Local-only UI preference: collapse/expand
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

  const statusPill = (status: OnboardingStepStatus) => {
    const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap";
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

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
      title="OBD Premium Dashboard"
      tagline="Access all your Ocala-focused AI business tools in one place."
      titleRight={
        <Link
          href="/#get-started"
          className="mt-1 text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline hover:underline-offset-4 dark:text-slate-300 dark:hover:text-white"
        >
          Get Started
        </Link>
      }
    >
      {/* Sections */}
      <div className="space-y-8">
        {/* Onboarding anchor target for sidebar link */}
        <div id="get-started" className="scroll-mt-28">
          {/* Onboarding guide panel (non-blocking, dismissible) */}
          {!onboardingLoading && onboarding?.ok && onboarding.dismissed === true ? (
            <div data-get-started-highlight="true" className="mt-7 inline-block rounded-2xl">
              <button
                type="button"
                onClick={() => setDismissed(false)}
                disabled={onboardingSaving}
                className="text-sm font-medium text-slate-700 hover:underline hover:underline-offset-2 dark:text-slate-200 disabled:opacity-60"
              >
                Show setup guide
              </button>
            </div>
          ) : null}

          {!onboardingLoading && onboarding?.ok && onboarding.dismissed === false ? (
            <section
              data-get-started-highlight="true"
              className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    Get started with OBD
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Recommended steps to set up your tools. Nothing is automatic — you’re always in control.
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setOnboardingCollapsed((v) => !v)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-200 dark:hover:bg-slate-900/45"
                  >
                    {onboardingCollapsed ? "Expand" : "Collapse"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    disabled={onboardingSaving}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/20 dark:text-slate-200 dark:hover:bg-slate-900/35 disabled:opacity-60"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Setup progress: {onboarding.progress.percent}%
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {onboarding.progress.completedRequired}/{onboarding.progress.totalRequired} required complete
                  </div>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-2 rounded-full bg-[#29c4a9] transition-[width]"
                    style={{ width: `${Math.max(0, Math.min(100, onboarding.progress.percent))}%` }}
                  />
                </div>
              </div>

              {/* Steps */}
              {!onboardingCollapsed ? (
                <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                  {onboarding.steps.map((step) => (
                    <div
                      key={step.key}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {step.title}
                          </div>
                          {statusPill(step.status)}
                        </div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
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
        </div>

        {APP_SECTIONS.map((section, sectionIndex) => {
          const SectionIcon = section.icon;
          return (
            <section key={sectionIndex} className={`space-y-6 ${sectionIndex === 0 ? "mt-7" : ""}`}>
              {/* Section Header */}
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <SectionIcon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">
                    {section.title}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {section.description}
                  </p>
                </div>
              </div>

              {/* Tiles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {section.tiles.map((tile, tileIndex) => {
                  const TileIcon = tile.icon;
                  const isComingSoon = tile.comingSoon === true;

                  // Coming Soon Tile
                  if (isComingSoon) {
                    return (
                      <div
                        key={tileIndex}
                        className="relative bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col opacity-60"
                      >
                        {/* Icon */}
                        <div className="mb-3">
                          <TileIcon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-semibold text-slate-600 dark:text-slate-400 mb-2">
                          {tile.title}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-slate-500 dark:text-slate-500 mb-4 flex-grow">
                          {tile.description}
                        </p>

                        {/* Coming Soon Button */}
                        <button
                          disabled
                          className="w-full px-4 py-2 text-sm font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 rounded-md cursor-not-allowed"
                        >
                          Coming Soon
                        </button>
                      </div>
                    );
                  }

                  // Live Tile (must have href)
                  if (!tile.href) {
                    return null;
                  }

                  return (
                    <div
                      key={tileIndex}
                      className="relative bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col hover:shadow-md transition-shadow"
                    >
                      {/* Icon */}
                      <div className="mb-3">
                        <TileIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                        {tile.title}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-grow">
                        {tile.description}
                      </p>

                      {/* CTA Button */}
                      <Link
                        href={tile.href}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#29c4a9] hover:bg-[#24b09a] rounded-md transition-colors"
                      >
                        {tile.buttonLabel}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Support & Learning (quiet, wide cards) */}
        <section className="space-y-6 pt-2">
          {/* Section Header */}
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <HelpCircle className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">
                Support &amp; Learning
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Find answers fast — or reach the team if you need human help.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Help Center (internal) */}
            <div className="h-full min-h-[220px] bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-7 md:p-8 flex flex-col transition-shadow transition-colors hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                  <Search className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold leading-tight text-slate-900 dark:text-white">
                  Help Center
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Search across OBD tools to understand how things work. Read-only. No changes made.
              </p>
              <div className="mt-auto pt-6">
                <Link
                  href="/help-center"
                  className="w-full inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-200 dark:hover:bg-slate-900/40"
                >
                  Open Help Center →
                </Link>
              </div>
            </div>

            {/* Contact Support (external) */}
            <div className="h-full min-h-[220px] bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-7 md:p-8 flex flex-col transition-shadow transition-colors hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold leading-tight text-slate-900 dark:text-white">
                  Contact Support
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Need help from the team? Send a support request and we’ll point you in the right direction.
              </p>
              <div className="mt-auto pt-6">
                <a
                  href="https://ocalabusinessdirectory.com/contact/"
                  className="w-full inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-200 dark:hover:bg-slate-900/40"
                  rel="noreferrer"
                >
                  Open Support →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Subtle Help Center discoverability hint (footer microcopy) */}
        <p className="mt-10 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          Questions about how things work? Visit the{" "}
          <Link
            href="/help-center"
            className="text-slate-700 dark:text-slate-200 hover:underline hover:underline-offset-2 focus-visible:underline focus-visible:underline-offset-2 focus-visible:outline-none"
          >
            Help Center
          </Link>
          {" "}or{" "}
          <Link
            href="/apps/ecosystem"
            className="text-slate-700 dark:text-slate-200 hover:underline hover:underline-offset-2 focus-visible:underline focus-visible:underline-offset-2 focus-visible:outline-none"
          >
            How OBD works
          </Link>
          .
        </p>
      </div>
    </OBDPageContainer>
  );
}

