"use client";

import { useSession, signOut } from "next-auth/react";

export default function SignOutButton() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition whitespace-nowrap"
      aria-label="Sign out"
    >
      Sign Out
    </button>
  );
}

