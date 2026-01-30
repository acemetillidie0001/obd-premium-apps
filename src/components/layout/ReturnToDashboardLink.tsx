"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function ReturnToDashboardLink() {
  const pathname = usePathname();
  const shouldShow =
    pathname === "/help-center" || pathname?.startsWith("/help-center/");

  if (!shouldShow) return null;

  return (
    <Link
      href="/apps"
      className="inline-flex items-center gap-2 rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition whitespace-nowrap"
      aria-label="Return to Dashboard"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span>Return to Dashboard</span>
    </Link>
  );
}

