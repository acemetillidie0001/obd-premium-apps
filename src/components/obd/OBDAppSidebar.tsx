"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { OBD_APPS, AppCategory } from "@/lib/obd-framework/apps.config";
import { getAppIcon } from "@/lib/obd-framework/app-icons";
import { normalizeAppHrefForPathname, toolHrefForPathname } from "@/lib/routing/appBasePaths";

interface OBDAppSidebarProps {
  isDark: boolean;
}

const CATEGORY_ORDER: AppCategory[] = ["content", "reputation", "google", "seo", "productivity", "branding"];

const CATEGORY_LABELS: Record<AppCategory, string> = {
  content: "Content & Writing",
  reputation: "Reputation & Reviews",
  google: "Google Business",
  seo: "SEO Tools",
  productivity: "Productivity",
  branding: "Design & Branding",
};

export default function OBDAppSidebar({ isDark }: OBDAppSidebarProps) {
  const pathname = usePathname();
  const theme = getThemeClasses(isDark);
  const brandProfileHref = toolHrefForPathname("brand-profile", pathname);
  const teamsUsersHref = toolHrefForPathname("teams-users", pathname);

  // Group apps by category
  const appsByCategory = CATEGORY_ORDER.reduce((acc, category) => {
    const categoryApps = OBD_APPS.filter((app) => app.category === category);
    if (categoryApps.length > 0) {
      acc[category] = categoryApps;
    }
    return acc;
  }, {} as Record<AppCategory, typeof OBD_APPS>);

  return (
    <aside className="lg:w-72 lg:sticky lg:top-28 self-start mb-8 lg:mb-0">
      <div className={`rounded-2xl shadow-lg border px-4 py-4 ${
        isDark ? "bg-slate-900/80 border-slate-700" : "bg-white border-slate-200"
      }`}>
        <p className={`text-xs font-semibold mb-4 ${theme.mutedText}`}>Premium Apps</p>
        <nav className="space-y-6">
          {/* ACCOUNT Section */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${theme.mutedText}`}>
              Account
            </p>
            <div className="space-y-1">
              <Link
                href={brandProfileHref}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition ${
                  pathname === brandProfileHref
                    ? "text-[#29c4a9] font-semibold border-l-4 border-[#29c4a9] pl-4 bg-transparent"
                    : isDark
                    ? "text-slate-500 hover:bg-slate-800/60"
                    : "text-slate-500 hover:bg-slate-100/70"
                }`}
              >
                <span className="flex-shrink-0">🎨</span>
                <span>Brand Profile</span>
              </Link>
              <Link
                href={teamsUsersHref}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition ${
                  pathname === teamsUsersHref
                    ? "text-[#29c4a9] font-semibold border-l-4 border-[#29c4a9] pl-4 bg-transparent"
                    : isDark
                    ? "text-slate-500 hover:bg-slate-800/60"
                    : "text-slate-500 hover:bg-slate-100/70"
                }`}
              >
                <span className="flex-shrink-0">👥</span>
                <span>Teams &amp; Users</span>
              </Link>
            </div>
          </div>

          {Object.entries(appsByCategory).map(([category, apps]) => (
            <div key={category}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${theme.mutedText}`}>
                {CATEGORY_LABELS[category as AppCategory]}
              </p>
              <div className="space-y-1">
                {apps.map((app) => {
                  const resolvedHref = app.href
                    ? normalizeAppHrefForPathname(app.href, pathname)
                    : undefined;
                  const isActive = resolvedHref ? pathname === resolvedHref : false;
                  const isLive = app.status === "live";
                  const isInProgress = app.status === "in-progress";
                  const hasHref = !!app.href && (isLive || isInProgress);

                  if (hasHref) {
                    return (
                      <Link
                        key={app.id}
                        href={resolvedHref!}
                        className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition ${
                          isActive
                            ? "text-[#29c4a9] font-semibold border-l-4 border-[#29c4a9] pl-4 bg-transparent"
                            : isDark
                            ? "text-slate-500 hover:bg-slate-800/60"
                            : "text-slate-500 hover:bg-slate-100/70"
                        }`}
                      >
                        {app.icon && getAppIcon(app.icon) && (
                          <span className="flex-shrink-0">
                            {getAppIcon(app.icon)}
                          </span>
                        )}
                        <span>{app.name}</span>
                      </Link>
                    );
                  }

                  // Coming soon or no href
                  return (
                    <div
                      key={app.id}
                      className={`block rounded-full px-3 py-2 text-sm ${
                        isDark ? "text-slate-400" : "text-slate-400"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{app.name}</span>
                        <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-400/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300/70 ml-2">
                          Soon
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
