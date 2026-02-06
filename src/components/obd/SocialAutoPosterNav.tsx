"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { normalizeAppHrefForPathname } from "@/lib/routing/appBasePaths";

interface SocialAutoPosterNavProps {
  isDark: boolean;
}

const navItems = [
  { href: "/apps/social-auto-poster", label: "Dashboard" },
  { href: "/apps/social-auto-poster/setup", label: "Setup" },
  { href: "/apps/social-auto-poster/composer", label: "Composer" },
  { href: "/apps/social-auto-poster/queue", label: "Queue" },
  { href: "/apps/social-auto-poster/activity", label: "Activity" },
];

export default function SocialAutoPosterNav({ isDark }: SocialAutoPosterNavProps) {
  const pathname = usePathname();
  const theme = getThemeClasses(isDark);

  return (
    <nav className="mb-6">
      <div className={`flex flex-wrap gap-2 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
        {navItems.map((item) => {
          const resolvedHref = normalizeAppHrefForPathname(item.href, pathname);
          const isActive = pathname === resolvedHref;
          return (
            <Link
              key={item.href}
              href={resolvedHref}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? `text-[#29c4a9] border-b-2 border-[#29c4a9] ${theme.headingText}`
                  : `${theme.mutedText} hover:${theme.headingText}`
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

