import "server-only";

import { prisma } from "@/lib/prisma";

export const LAST_ACTIVE_TOUCH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function touchLastActive(businessId: string, userId: string): Promise<void> {
  if (!businessId || !userId) return;

  const now = new Date();
  const threshold = new Date(now.getTime() - LAST_ACTIVE_TOUCH_WINDOW_MS);

  const membership = await prisma.businessUser.findFirst({
    where: {
      businessId,
      userId,
      status: "ACTIVE",
    },
    select: { lastActiveAt: true },
  });

  if (!membership) return;

  const shouldUpdate = membership.lastActiveAt === null || membership.lastActiveAt < threshold;
  if (!shouldUpdate) return;

  // Guard the write with the same threshold to avoid churn during concurrent requests.
  await prisma.businessUser.updateMany({
    where: {
      businessId,
      userId,
      status: "ACTIVE",
      OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: threshold } }],
    },
    data: { lastActiveAt: now },
  });
}

