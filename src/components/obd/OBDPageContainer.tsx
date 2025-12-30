"use client";

import Link from "next/link";
import OBDAppSidebar from "./OBDAppSidebar";
import ThemeToggle from "./ThemeToggle";
import { getPageBackground, getBreadcrumbClasses, CONTAINER_WIDTH } from "@/lib/obd-framework/layout-helpers";
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
}

export default function OBDPageContainer({
  children,
  isDark,
  onThemeToggle,
  title,
  tagline,
  theme: controlledTheme,
  onThemeChange,
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

  return (
    <main className={`${getPageBackground(effectiveIsDark)} transition-colors`}>
      <div className={CONTAINER_WIDTH}>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <OBDAppSidebar isDark={effectiveIsDark} />

          {/* Main Content */}
          <section className="flex-1">
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

