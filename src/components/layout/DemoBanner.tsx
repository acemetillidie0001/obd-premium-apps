import Link from "next/link";

interface DemoBannerProps {
  isDemo: boolean;
}

/**
 * Demo Mode Banner
 * Displays a banner when demo mode is active, shown only on /apps routes.
 * Provides links to upgrade or exit demo mode.
 */
export default function DemoBanner({ isDemo }: DemoBannerProps) {
  if (!isDemo) {
    return null;
  }

  return (
    <div className="w-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          {/* Banner Text */}
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Demo Mode: View-only preview. Upgrade to generate, save, or publish.
            </p>
            <p className="text-xs text-amber-800/70 dark:text-amber-200/70 mt-1">
              Explore the apps below — actions that save, publish, or generate are disabled in demo mode.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Link
              href="https://ocalabusinessdirectory.com/premium/#pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-gradient-to-r from-[#1EB9A7] to-[#0AC8E9] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 transition whitespace-nowrap"
            >
              See Plans & Pricing
            </Link>
            <Link
              href="/apps/demo/exit"
              className="rounded-full bg-slate-600 hover:bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 transition whitespace-nowrap"
            >
              Exit Demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
