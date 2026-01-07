"use client";

import { usePathname } from "next/navigation";
import DemoBanner from "@/components/layout/DemoBanner";

/**
 * Conditionally renders header/footer based on pathname
 * Hides header/footer (which contains /help link) for public booking pages
 * Shows DemoBanner on /apps and all /apps/* routes when demo mode is active
 */
export default function ConditionalLayout({
  children,
  header,
  footer,
  isDemo,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
  isDemo: boolean;
}) {
  const pathname = usePathname();
  const isBookingPage = pathname?.startsWith("/book/");
  // Check if current route is /apps or any /apps/* subroute
  const isAppsRoute = pathname === "/apps" || pathname?.startsWith("/apps/");

  return (
    <>
      {!isBookingPage && header}
      {/* Demo banner shown for /apps and all /apps/* routes when demo mode is active */}
      {/* Renders above the app shell (sidebar + content) for consistent visibility */}
      {isDemo && isAppsRoute && <DemoBanner isDemo={isDemo} />}
      {children}
      {!isBookingPage && footer}
    </>
  );
}

