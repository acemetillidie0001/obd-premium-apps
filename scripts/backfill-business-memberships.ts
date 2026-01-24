#!/usr/bin/env tsx
/**
 * Backfill: Business + BusinessUser memberships
 *
 * Goal:
 * - Introduce a real Business identity without breaking existing tenant keys.
 * - Business.id is the existing tenant key (V3: businessId == userId).
 *
 * Idempotent:
 * - Safe to re-run. Uses upserts for Business and BusinessUser.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-business-memberships.ts
 */

import { PrismaClient, TeamRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const batchSize = 500;
  let processed = 0;
  let cursorId: string | undefined;

  console.log("[backfill] Starting Business + BusinessUser backfill...");

  while (true) {
    const users = await prisma.user.findMany({
      select: { id: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    if (users.length === 0) break;

    for (const u of users) {
      // 1) Ensure Business exists (Business.id = user.id)
      await prisma.business.upsert({
        where: { id: u.id },
        create: { id: u.id },
        update: {},
      });

      // 2) Ensure membership exists (owner self-membership)
      await prisma.businessUser.upsert({
        where: {
          businessId_userId: {
            businessId: u.id,
            userId: u.id,
          },
        },
        create: {
          businessId: u.id,
          userId: u.id,
          role: TeamRole.OWNER,
          status: "ACTIVE",
        },
        update: {
          // Keep backfill invariant stable if this row already exists.
          role: TeamRole.OWNER,
          status: "ACTIVE",
        },
      });
    }

    processed += users.length;
    cursorId = users[users.length - 1]?.id;

    console.log(`[backfill] Processed ${processed} users...`);
  }

  console.log(`[backfill] Done. Total users processed: ${processed}`);
}

main()
  .catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backfill] Failed:", msg);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

