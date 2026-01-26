import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasDemoCookie } from "@/lib/demo/demo-cookie";

import TeamsUsersPageClient from "./TeamsUsersPageClient";

export const runtime = "nodejs";

/**
 * UI guardrail wrapper:
 * - If no ACTIVE membership, check whether the user has ANY business association.
 * - If none, show the "No business found..." message (client renders it).
 *
 * LOCK NOTE:
 * Teams & Users depends on explicit Business creation.
 * This is intentional.
 * No auto-creation occurs to preserve data integrity.
 *
 * No API changes. No auto-creation.
 */
export default async function TeamsUsersPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Demo mode bypasses real-tenant membership checks.
  const cookieStore = await cookies();
  const isDemo = hasDemoCookie(cookieStore);

  let noBusinessFound = false;

  if (!isDemo && userId) {
    const activeMembership = await prisma.businessUser.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { businessId: true },
    });

    if (!activeMembership) {
      const anyMembership = await prisma.businessUser.findFirst({
        where: { userId },
        select: { businessId: true },
      });

      // Legacy compatibility: some systems used Business.id === userId.
      const legacyBusiness = await prisma.business.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      noBusinessFound = !anyMembership && !legacyBusiness;
    }
  }

  return <TeamsUsersPageClient noBusinessFound={noBusinessFound} />;
}

