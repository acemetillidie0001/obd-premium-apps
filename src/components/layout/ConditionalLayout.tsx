"use client";

import { usePathname } from "next/navigation";
import DemoBanner from "./DemoBanner";

/**
 * Conditionally renders header/footer based on pathname
 * Hides header/footer (which contains /help link) for public booking pages
 * Shows DemoBanner only for /apps routes when demo mode is active
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
  const isAppsRoute = pathname?.startsWith("/apps");

  return (
    <>
      {!isBookingPage && header}
      {/* Demo banner only shown for /apps routes */}
      {isAppsRoute && <DemoBanner isDemo={isDemo} />}
      {children}
      {!isBookingPage && footer}
    </>
  );
}

