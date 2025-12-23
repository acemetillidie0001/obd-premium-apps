"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export default function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white">
        Loading...
      </div>
    );
  }

  if (session?.user) {
    // Display name if available, otherwise email
    const displayName = session.user.name || session.user.email || "";
    // Truncate long emails gracefully
    const displayText = displayName.length > 30 
      ? `${displayName.substring(0, 27)}...` 
      : displayName;

    return (
      <span 
        className="text-sm text-white/80 truncate max-w-[280px] sm:max-w-[320px]"
        aria-label={`Logged in as: ${displayName}`}
        title={displayName}
      >
        Logged in as: {displayText}
      </span>
    );
  }

  return (
    <Link
      href="/login"
      className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
      aria-label="Login to Premium"
    >
      Login to Premium
    </Link>
  );
}

