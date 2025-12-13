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
}

export default function OBDPageContainer({
  children,
  isDark,
  onThemeToggle,
  title,
  tagline,
}: OBDPageContainerProps) {
  const theme = getThemeClasses(isDark);

  return (
    <main className={`${getPageBackground(isDark)} transition-colors`}>
      <div className={CONTAINER_WIDTH}>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <OBDAppSidebar isDark={isDark} />

          {/* Main Content */}
          <section className="flex-1">
            {/* Breadcrumb */}
            <div className="mb-4">
              <Link
                href="/"
                className={getBreadcrumbClasses(isDark)}
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
            <ThemeToggle isDark={isDark} onToggle={onThemeToggle} />

            {/* Page content */}
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}

