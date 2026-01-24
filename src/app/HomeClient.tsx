"use client";

import Link from "next/link";
import { OBD_APPS, AppCategory } from "@/lib/obd-framework/apps.config";
import { getAppIcon } from "@/lib/obd-framework/app-icons";
import { getAppPreview } from "@/lib/obd-framework/app-previews";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";

const DASHBOARD_SECTIONS: { id: AppCategory; title: string; tagline: string }[] = [
  { id: "content", title: "Content & Writing Tools", tagline: "Create descriptions, posts, FAQs, and content tailored to Ocala customers." },
  { id: "reputation", title: "Reputation & Reviews", tagline: "Protect and grow your reputation with thoughtful, on-brand responses." },
  { id: "google", title: "Google Business & Local Search", tagline: "Audit and improve how your business appears when locals search in Ocala." },
  { id: "seo", title: "SEO Tools", tagline: "Plan smarter pages and structure so search engines understand—and reward—your business." },
  { id: "productivity", title: "Productivity & Automation", tagline: "Save time with systems that schedule, follow up, and move your business forward." },
  { id: "branding", title: "Design & Branding", tagline: "Clarify your visual identity so every touchpoint feels premium and consistent." },
];

export default function HomeClient() {
  const { theme, isDark, toggleTheme } = useOBDTheme();

  const pageBg = isDark ? "bg-slate-950" : "bg-slate-50";
  const panelBg = isDark ? "bg-gradient-to-b from-slate-900/95 to-slate-950" : "bg-white";
  const mutedText = isDark ? "text-slate-300" : "text-slate-600";
  const cardBgLive = isDark ? "bg-slate-900/80 border-slate-800 shadow-lg shadow-slate-950/60 text-slate-50" : "bg-white border-slate-200 shadow-lg shadow-slate-200 text-slate-900";
  const cardBgNonLive = isDark ? "bg-slate-900/80 border-slate-800 shadow-md shadow-slate-950/40 text-slate-50 opacity-90" : "bg-white border-slate-200 shadow-md shadow-slate-200/50 text-slate-900 opacity-90";

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
                  href="/apps/brand-profile"
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

                {/* Billing & Plan Card (COMING SOON) */}
                <div
                  className={`relative flex h-full min-h-[200px] flex-col justify-between rounded-2xl border px-6 py-6 text-center transition-shadow duration-200 ${cardBgNonLive} opacity-90`}
                >
                  <div className="space-y-2">
                    {/* Badge: Coming Q1 2026 (non-interactive chip) */}
                    <div className="flex justify-center mb-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] pointer-events-none ${
                        isDark
                          ? "border-[#29c4a9]/50 bg-[#29c4a9]/10 text-[#29c4a9]"
                          : "border-[#29c4a9]/60 bg-[#29c4a9]/10 text-[#29c4a9]"
                      }`}>
                        Coming Q1 2026
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-center w-full">
                      <div className="flex-shrink-0 text-2xl">💳</div>
                      <h3 className={`text-base font-semibold ${
                        isDark ? "text-slate-50" : "text-slate-900"
                      }`}>
                        Billing & Plan
                      </h3>
                    </div>
                    <p className={`mt-1 text-sm ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}>
                      Manage your subscription, invoices, and feature access.
                    </p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title="Billing management launches Q1 2026"
                      className="inline-flex items-center justify-center rounded-full border px-6 py-2 text-sm font-semibold cursor-not-allowed pointer-events-none transition-opacity border-[#29c4a9]/50 bg-transparent opacity-80"
                    >
                      Coming Soon
                    </button>
                  </div>
                </div>

                {/* Team & Users Card (ACTIVE) */}
                <Link
                  href="/apps/teams-users"
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

                      // Title with icon - centered
                      const TitleSection = (
                        <div className="flex items-center justify-center gap-2 text-center w-full">
                          {app.icon && getAppIcon(app.icon) && (
                            <div className="flex-shrink-0">
                              {getAppIcon(app.icon)}
                            </div>
                          )}
                          <h3
                            className={`text-base font-semibold ${
                              isDark ? "text-slate-50" : "text-slate-900"
                            }`}
                          >
                            {app.name}
                          </h3>
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
                        return (
                          <Link
                            key={app.id}
                            href={app.href!}
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
          </div>
        </section>
      </div>
    </main>
  );
}

