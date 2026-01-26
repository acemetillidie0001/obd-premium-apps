import { prisma } from "@/lib/prisma";

export type BusinessAccessGateMode = "noBusiness" | "noMembership";

type Args = {
  userId: string | null;
  isDemo: boolean;
};

/**
 * Server-side UX guardrail classifier.
 *
 * NOTE:
 * - This does NOT change tenant enforcement; it only prevents apps from rendering
 *   into a guaranteed fail-closed state.
 * - No cross-tenant reads: queries are scoped by the signed-in userId only.
 */
export async function getBusinessAccessGateMode({ userId, isDemo }: Args): Promise<BusinessAccessGateMode | null> {
  if (isDemo) return null;
  if (!userId) return null;

  const activeMembership = await prisma.businessUser.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { businessId: true },
  });
  if (activeMembership) return null;

  const anyMembership = await prisma.businessUser.findFirst({
    where: { userId },
    select: { businessId: true },
  });

  // Legacy compatibility: some systems used Business.id === userId.
  const legacyBusiness = await prisma.business.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!anyMembership && !legacyBusiness) return "noBusiness";
  return "noMembership";
}

