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

import "dotenv/config";
import dotenv from "dotenv";
import path from "node:path";
import { TeamRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { URL } from "node:url";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing — env not loaded");
}

function requireDatabaseUrl(): URL {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error("DATABASE_URL is missing — env not loaded");
  }

  try {
    const url = new URL(raw);
    if (!url.hostname) {
      throw new Error("missing-hostname");
    }
    return url;
  } catch {
    throw new Error("DATABASE_URL is missing — env not loaded");
  }
}

async function assertDbConnectionOrThrow(prisma: PrismaClient, dbHost: string) {
  try {
    // SELECT 1 equivalent: ensures we can connect and execute a trivial query
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`DB connectivity check failed (DB_HOST=${dbHost}): ${msg}`);
  }
}

type BackfillUser = { id: string; email?: string | null };

async function backfillForUsers(prisma: PrismaClient, users: BackfillUser[]) {
  const ids = users.map((u) => u.id);

  const existingBusinesses = await prisma.business.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const businessIdSet = new Set(existingBusinesses.map((b) => b.id));

  const existingMemberships = await prisma.businessUser.findMany({
    where: {
      userId: { in: ids },
      businessId: { in: ids },
    },
    select: {
      businessId: true,
      userId: true,
      role: true,
      status: true,
    },
  });

  const selfMembershipByUserId = new Map<
    string,
    { role: TeamRole; status: string }
  >();
  for (const m of existingMemberships) {
    if (m.userId === m.businessId) {
      selfMembershipByUserId.set(m.userId, { role: m.role, status: m.status });
    }
  }

  let businessCreated = 0;
  let businessExisting = 0;
  let membershipsCreated = 0;
  let membershipsUpdated = 0;
  let membershipsUnchanged = 0;

  for (const u of users) {
    // 1) Ensure Business exists (Business.id = user.id)
    if (!businessIdSet.has(u.id)) {
      await prisma.business.create({ data: { id: u.id } });
      businessCreated += 1;
    } else {
      businessExisting += 1;
    }

    // 2) Ensure owner self-membership exists and is ACTIVE/OWNER
    const existing = selfMembershipByUserId.get(u.id);
    if (!existing) {
      await prisma.businessUser.create({
        data: {
          businessId: u.id,
          userId: u.id,
          role: TeamRole.OWNER,
          status: "ACTIVE",
        },
      });
      membershipsCreated += 1;
      continue;
    }

    const needsUpdate =
      existing.role !== TeamRole.OWNER || existing.status !== "ACTIVE";

    if (!needsUpdate) {
      membershipsUnchanged += 1;
      continue;
    }

    await prisma.businessUser.update({
      where: {
        businessId_userId: {
          businessId: u.id,
          userId: u.id,
        },
      },
      data: {
        role: TeamRole.OWNER,
        status: "ACTIVE",
      },
    });
    membershipsUpdated += 1;
  }

  return {
    users: users.length,
    businessCreated,
    businessExisting,
    businessTotalSeen: businessCreated + businessExisting,
    membershipsCreated,
    membershipsUpdated,
    membershipsUnchanged,
    membershipsTotalSeen:
      membershipsCreated + membershipsUpdated + membershipsUnchanged,
  };
}

async function main() {
  const { prisma } = await import("./_prisma");
  try {
    const dbUrl = requireDatabaseUrl();
    const dbHost = dbUrl.hostname;

    console.log("[backfill] DB_HOST=", dbHost);

    // Hard fail early if we can't connect
    await assertDbConnectionOrThrow(prisma, dbHost);

  const backfillEmail = process.env.BACKFILL_EMAIL?.trim();
  if (backfillEmail) {
    console.log("[backfill] BACKFILL_EMAIL set. Backfilling a single user...");

    const user = await prisma.user.findUnique({
      where: { email: backfillEmail },
      select: { id: true, email: true },
    });

    if (!user) {
      console.error("[backfill] No user found for BACKFILL_EMAIL:", backfillEmail);
      process.exitCode = 1;
      return;
    }

    console.log("[backfill] User found:", { id: user.id, email: user.email });
    console.log("[backfill] Business ids found: 1");

    const summary = await backfillForUsers(prisma, [user]);
    console.log("[backfill] Summary:", {
      businesses: {
        created: summary.businessCreated,
        existing: summary.businessExisting,
      },
      memberships: {
        created: summary.membershipsCreated,
        updated: summary.membershipsUpdated,
        unchanged: summary.membershipsUnchanged,
      },
    });

    const postMemberships = await prisma.businessUser.findMany({
      where: { userId: user.id },
      select: { businessId: true, role: true, status: true },
      orderBy: [{ createdAt: "asc" }],
    });

    console.log(`POST-CHECK: memberships for ${user.email} = ${postMemberships.length}`);
    for (const m of postMemberships) {
      console.log("[backfill] POST-CHECK membership:", {
        businessId: m.businessId,
        role: m.role,
        status: m.status,
      });
    }

    return;
  }

  const batchSize = 500;
  let processed = 0;
  let cursorId: string | undefined;

  console.log("[backfill] Starting Business + BusinessUser backfill...");

  while (true) {
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    if (users.length === 0) break;

    const summary = await backfillForUsers(prisma, users);

    const postMemberships = await prisma.businessUser.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      select: { userId: true, businessId: true, role: true, status: true },
      orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
    });

    const postByUserId = new Map<
      string,
      Array<{ businessId: string; role: TeamRole; status: string }>
    >();
    for (const m of postMemberships) {
      const arr = postByUserId.get(m.userId) ?? [];
      arr.push({ businessId: m.businessId, role: m.role, status: m.status });
      postByUserId.set(m.userId, arr);
    }

    for (const u of users) {
      const label = u.email ?? u.id;
      const rows = postByUserId.get(u.id) ?? [];
      console.log(`POST-CHECK: memberships for ${label} = ${rows.length}`);
      for (const row of rows) {
        console.log("[backfill] POST-CHECK membership:", row);
      }
    }

    processed += users.length;
    cursorId = users[users.length - 1]?.id;

    console.log(`[backfill] Processed ${processed} users...`, {
      businesses: {
        created: summary.businessCreated,
        existing: summary.businessExisting,
      },
      memberships: {
        created: summary.membershipsCreated,
        updated: summary.membershipsUpdated,
        unchanged: summary.membershipsUnchanged,
      },
    });
  }

    console.log(`[backfill] Done. Total users processed: ${processed}`);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backfill] Failed:", msg);
    process.exitCode = 1;
  });

