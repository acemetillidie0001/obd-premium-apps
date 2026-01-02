"use client";

import Link from "next/link";
import OBDAppSidebar from "./OBDAppSidebar";
import ThemeToggle from "./ThemeToggle";
import { getPageBackground, getBreadcrumbClasses, CONTAINER_WIDTH, CONTAINER_WIDTH_FULL, CONTAINER_WIDTH_CONSTRAINED } from "@/lib/obd-framework/layout-helpers";
import { getThemeClasses } from "@/lib/obd-framework/theme";

interface OBDPageContainerProps {
  children: React.ReactNode;
  isDark: boolean;
  onThemeToggle: () => void;
  title: string;
  tagline: string;
  // Optional controlled theme props (for persisted theme)
  theme?: "light" | "dark";
  onThemeChange?: (next: "light" | "dark") => void;
  // Optional full-width mode (default: false, maintains backward compatibility)
  fullWidth?: boolean;
  // Optional constrained mode (default: false, uses max-w-6xl mx-auto when true)
  constrained?: boolean;
}

export default function OBDPageContainer({
  children,
  isDark,
  onThemeToggle,
  title,
  tagline,
  theme: controlledTheme,
  onThemeChange,
  fullWidth = false,
  constrained = false,
}: OBDPageContainerProps) {
  // Use controlled theme if provided, otherwise use isDark prop (backward compatible)
  const effectiveIsDark = controlledTheme ? controlledTheme === "dark" : isDark;
  const theme = getThemeClasses(effectiveIsDark);

  // Handle theme toggle: prefer onThemeChange if provided, otherwise use onThemeToggle
  const handleThemeToggle = () => {
    if (onThemeChange && controlledTheme) {
      onThemeChange(controlledTheme === "light" ? "dark" : "light");
    } else {
      onThemeToggle();
    }
  };

  // Determine container width class: constrained takes precedence, then fullWidth, else default full-width
  const containerClass = constrained 
    ? CONTAINER_WIDTH_CONSTRAINED 
    : fullWidth 
    ? CONTAINER_WIDTH_FULL 
    : CONTAINER_WIDTH;

  return (
    <main className={`${getPageBackground(effectiveIsDark)} transition-colors`} id="main-content">
      {/* P2-13: Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#29c4a9] focus:text-white focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#29c4a9] focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <div className={containerClass}>
        <div className="flex flex-col lg:flex-row gap-8 min-w-0">
          {/* Sidebar */}
          <OBDAppSidebar isDark={effectiveIsDark} />

          {/* Main Content */}
          <section className="flex-1 min-w-0 overflow-x-hidden">
            {/* Breadcrumb */}
            <div className="mb-4">
              <Link
                href="/"
                className={getBreadcrumbClasses(effectiveIsDark)}
              >
                ← Dashboard
              </Link>
            </div>

            {/* Heading + tagline */}
            <h1 className={`text-2xl md:text-3xl font-bold obd-heading ${theme.headingText}`}>
              {title}
            </h1>
            <p className={`mt-2 text-sm md:text-base obd-soft-text ${theme.mutedText}`}>
              {tagline}
            </p>

            {/* Theme toggle */}
            <ThemeToggle isDark={effectiveIsDark} onToggle={handleThemeToggle} />

            {/* Page content */}
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}

