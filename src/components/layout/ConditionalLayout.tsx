"use client";

import { usePathname } from "next/navigation";

/**
 * Conditionally renders header/footer based on pathname
 * Hides header/footer (which contains /help link) for public booking pages
 */
export default function ConditionalLayout({
  children,
  header,
  footer,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBookingPage = pathname?.startsWith("/book/");

  return (
    <>
      {!isBookingPage && header}
      {children}
      {!isBookingPage && footer}
    </>
  );
}

