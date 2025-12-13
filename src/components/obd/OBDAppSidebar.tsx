"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getThemeClasses } from "@/lib/obd-framework/theme";

const apps = [
  {
    title: "AI Review Responder",
    href: "/apps/review-responder",
  },
  {
    title: "AI Business Description Writer",
    href: "/apps/business-description-writer",
  },
  {
    title: "AI Social Media Post Creator",
    href: "/apps/social-media-post-creator",
  },
  {
    title: "AI FAQ Generator",
    href: "/apps/faq-generator",
  },
  {
    title: "AI Content Writer",
    href: "/apps/content-writer",
  },
  {
    title: "AI Image Caption Generator",
    href: "/apps/image-caption-generator",
  },
  {
    title: "Local Keyword Research Tool",
    href: "/apps/local-keyword-research",
  },
  {
    title: "Google Business Profile Pro",
    href: "/apps/google-business-pro",
  },
];

interface OBDAppSidebarProps {
  isDark: boolean;
}

export default function OBDAppSidebar({ isDark }: OBDAppSidebarProps) {
  const pathname = usePathname();
  const theme = getThemeClasses(isDark);

  return (
    <aside className="lg:w-72 lg:sticky lg:top-28 self-start mb-8 lg:mb-0">
      <div className={`rounded-2xl shadow-lg border px-4 py-4 ${
        isDark ? "bg-slate-900/80 border-slate-700" : "bg-white border-slate-200"
      }`}>
        <p className={`text-xs font-semibold mb-3 ${theme.mutedText}`}>Premium Apps</p>
        <nav className="space-y-1">
          {apps.map((app) => {
            const isActive = pathname === app.href;
            return (
              <Link
                key={app.href}
                href={app.href}
                className={`block rounded-full px-3 py-2 text-sm transition ${
                  isActive
                    ? "text-[#29c4a9] font-semibold border-l-4 border-[#29c4a9] pl-4 bg-transparent"
                    : isDark
                    ? "text-slate-200 hover:bg-slate-800"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {app.title}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

