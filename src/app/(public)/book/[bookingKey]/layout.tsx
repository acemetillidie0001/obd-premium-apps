import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book Appointment",
  description: "Book an appointment with this business",
};

/**
 * Minimal layout for public booking page
 * Completely isolated - no shared components or providers
 */
export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

