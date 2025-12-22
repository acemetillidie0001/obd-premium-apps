"use client";

import { useSession, signOut } from "next-auth/react";
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
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/80 hidden sm:inline">
          {session.user.email}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
    >
      Login to Premium
    </Link>
  );
}

