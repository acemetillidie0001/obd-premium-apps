#!/usr/bin/env tsx
/**
 * Business + Membership integrity check (one-time script)
 *
 * Usage:
 *   pnpm run check:business-integrity
 *
 * Exits:
 * - 0 on PASS
 * - 1 if any invariants fail
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CountRow = { count: number };

function printHeader(title: string) {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

function printCheck(label: string, ok: boolean, details?: string) {
  const status = ok ? "PASS" : "FAIL";
  console.log(`- ${status} ${label}${details ? ` — ${details}` : ""}`);
}

async function countQuery(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(sql);
  const n = rows?.[0]?.count ?? 0;
  return typeof n === "number" ? n : Number(n);
}

async function sampleIdsQuery(sql: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(sql);
  return rows.map((r) => r.id);
}

async function sampleDupesQuery(sql: string): Promise<Array<{ businessId: string; userId: string; count: number }>> {
  const rows = await prisma.$queryRawUnsafe<Array<{ businessId: string; userId: string; count: number }>>(sql);
  return rows.map((r) => ({
    businessId: r.businessId,
    userId: r.userId,
    count: typeof r.count === "number" ? r.count : Number(r.count),
  }));
}

async function sampleActiveCountsQuery(
  sql: string
): Promise<Array<{ businessId: string; activeCount: number; totalCount: number }>> {
  const rows = await prisma.$queryRawUnsafe<Array<{ businessId: string; activeCount: number; totalCount: number }>>(sql);
  return rows.map((r) => ({
    businessId: r.businessId,
    activeCount: typeof r.activeCount === "number" ? r.activeCount : Number(r.activeCount),
    totalCount: typeof r.totalCount === "number" ? r.totalCount : Number(r.totalCount),
  }));
}

async function main() {
  printHeader("Business Integrity Check");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const usersCount = await prisma.user.count();
  const businessesCount = await prisma.business.count();
  const membershipsCount = await prisma.businessUser.count();

  console.log("\nCounts");
  console.log(`- Users: ${usersCount}`);
  console.log(`- Businesses: ${businessesCount}`);
  console.log(`- BusinessUsers (memberships): ${membershipsCount}`);

  // Invariant 1: Every User has Business(id=user.id) OR at least one membership.
  // This supports the current tenant-key design (V3: businessId == userId), while
  // remaining compatible with future multi-business membership designs.
  const usersMissingBothCount = await countQuery(`
    SELECT COUNT(*)::int AS count
    FROM "User" u
    LEFT JOIN "BusinessUser" bu ON bu."userId" = u.id
    LEFT JOIN "Business" b ON b.id = u.id
    WHERE bu."userId" IS NULL AND b.id IS NULL
  `);
  const usersMissingBothSample = usersMissingBothCount
    ? await sampleIdsQuery(`
        SELECT u.id
        FROM "User" u
        LEFT JOIN "BusinessUser" bu ON bu."userId" = u.id
        LEFT JOIN "Business" b ON b.id = u.id
        WHERE bu."userId" IS NULL AND b.id IS NULL
        ORDER BY u.id
        LIMIT 20
      `)
    : [];

  // Invariant 2: Every Business has at least one OWNER membership.
  const businessesMissingOwnerCount = await countQuery(`
    SELECT COUNT(*)::int AS count
    FROM "Business" b
    LEFT JOIN "BusinessUser" bu
      ON bu."businessId" = b.id
     AND bu.role = 'OWNER'
    WHERE bu.id IS NULL
  `);
  const businessesMissingOwnerSample = businessesMissingOwnerCount
    ? await sampleIdsQuery(`
        SELECT b.id
        FROM "Business" b
        LEFT JOIN "BusinessUser" bu
          ON bu."businessId" = b.id
         AND bu.role = 'OWNER'
        WHERE bu.id IS NULL
        ORDER BY b.id
        LIMIT 20
      `)
    : [];

  // Invariant 3: No Business has 0 active members.
  // (status is a string in schema; treat ACTIVE as the only "active" state.)
  const businessesZeroActiveCount = await countQuery(`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT b.id AS "businessId",
             COUNT(bu.id) FILTER (WHERE bu.status = 'ACTIVE')::int AS "activeCount",
             COUNT(bu.id)::int AS "totalCount"
      FROM "Business" b
      LEFT JOIN "BusinessUser" bu ON bu."businessId" = b.id
      GROUP BY b.id
      HAVING COUNT(bu.id) FILTER (WHERE bu.status = 'ACTIVE') = 0
    ) t
  `);
  const businessesZeroActiveSample = businessesZeroActiveCount
    ? await sampleActiveCountsQuery(`
        SELECT b.id AS "businessId",
               COUNT(bu.id) FILTER (WHERE bu.status = 'ACTIVE')::int AS "activeCount",
               COUNT(bu.id)::int AS "totalCount"
        FROM "Business" b
        LEFT JOIN "BusinessUser" bu ON bu."businessId" = b.id
        GROUP BY b.id
        HAVING COUNT(bu.id) FILTER (WHERE bu.status = 'ACTIVE') = 0
        ORDER BY b.id
        LIMIT 20
      `)
    : [];

  // Report: suspended-only businesses (subset of zero-active where there is at least one membership).
  const suspendedOnlyBusinessesCount = await countQuery(`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT b.id AS "businessId",
             COUNT(bu.id) FILTER (WHERE bu.status = 'ACTIVE')::int AS "activeCount",
             COUNT(bu.id)::int AS "totalCount"
      FROM "Business" b
      LEFT JOIN "BusinessUser" bu ON bu."businessId" = b.id
      GROUP BY b.id
      HAVING COUNT(bu.id) FILTER (WHERE bu.status = 'ACTIVE') = 0
         AND COUNT(bu.id) > 0
    ) t
  `);
  const suspendedOnlyBusinessesSample = suspendedOnlyBusinessesCount
    ? await sampleActiveCountsQuery(`
        SELECT b.id AS "businessId",
               COUNT(bu.id) FILTER (WHERE bu.status = 'ACTIVE')::int AS "activeCount",
               COUNT(bu.id)::int AS "totalCount"
        FROM "Business" b
        LEFT JOIN "BusinessUser" bu ON bu."businessId" = b.id
        GROUP BY b.id
        HAVING COUNT(bu.id) FILTER (WHERE bu.status = 'ACTIVE') = 0
           AND COUNT(bu.id) > 0
        ORDER BY b.id
        LIMIT 20
      `)
    : [];

  // Invariant 4: No duplicate memberships (should be prevented by @@unique([businessId, userId])).
  const duplicateMembershipPairsCount = await countQuery(`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT "businessId", "userId", COUNT(*)::int AS count
      FROM "BusinessUser"
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
    ) t
  `);
  const duplicateMembershipPairsSample = duplicateMembershipPairsCount
    ? await sampleDupesQuery(`
        SELECT "businessId", "userId", COUNT(*)::int AS count
        FROM "BusinessUser"
        GROUP BY 1, 2
        HAVING COUNT(*) > 1
        ORDER BY count DESC, "businessId" ASC, "userId" ASC
        LIMIT 20
      `)
    : [];

  // Print results
  printHeader("Invariant Checks");

  const invUserHasBusinessOrMembershipOk = usersMissingBothCount === 0;
  printCheck(
    "Every User has Business(id=user.id) OR at least one membership",
    invUserHasBusinessOrMembershipOk,
    invUserHasBusinessOrMembershipOk ? undefined : `${usersMissingBothCount} user(s) missing both`
  );
  if (!invUserHasBusinessOrMembershipOk) {
    console.log("  Sample userIds:", usersMissingBothSample.join(", ") || "(none)");
  }

  const invBusinessHasOwnerOk = businessesMissingOwnerCount === 0;
  printCheck(
    "Every Business has at least one OWNER membership",
    invBusinessHasOwnerOk,
    invBusinessHasOwnerOk ? undefined : `${businessesMissingOwnerCount} business(es) missing OWNER`
  );
  if (!invBusinessHasOwnerOk) {
    console.log("  Sample businessIds:", businessesMissingOwnerSample.join(", ") || "(none)");
  }

  const invBusinessHasActiveMemberOk = businessesZeroActiveCount === 0;
  printCheck(
    "No Business has 0 active members",
    invBusinessHasActiveMemberOk,
    invBusinessHasActiveMemberOk ? undefined : `${businessesZeroActiveCount} business(es) with 0 active members`
  );
  if (!invBusinessHasActiveMemberOk) {
    console.log(
      "  Sample businesses:",
      businessesZeroActiveSample
        .map((b) => `${b.businessId} (active=${b.activeCount}, total=${b.totalCount})`)
        .join(", ") || "(none)"
    );
  }

  const invNoDuplicateMembershipsOk = duplicateMembershipPairsCount === 0;
  printCheck(
    "No duplicate (businessId, userId) memberships",
    invNoDuplicateMembershipsOk,
    invNoDuplicateMembershipsOk ? undefined : `${duplicateMembershipPairsCount} duplicate pair(s)`
  );
  if (!invNoDuplicateMembershipsOk) {
    console.log(
      "  Sample duplicates:",
      duplicateMembershipPairsSample
        .map((d) => `${d.businessId}/${d.userId} (count=${d.count})`)
        .join(", ") || "(none)"
    );
  }

  printHeader("Additional Reporting");
  console.log(`- Suspended-only businesses: ${suspendedOnlyBusinessesCount}`);
  if (suspendedOnlyBusinessesCount) {
    console.log(
      "  Sample businesses:",
      suspendedOnlyBusinessesSample
        .map((b) => `${b.businessId} (active=${b.activeCount}, total=${b.totalCount})`)
        .join(", ") || "(none)"
    );
  }

  const failed =
    !invUserHasBusinessOrMembershipOk ||
    !invBusinessHasOwnerOk ||
    !invBusinessHasActiveMemberOk ||
    !invNoDuplicateMembershipsOk;

  printHeader("Result");
  if (failed) {
    console.log("FAIL — one or more invariants failed.");
    process.exitCode = 1;
  } else {
    console.log("PASS — all invariants satisfied.");
    process.exitCode = 0;
  }
}

main()
  .catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("\n[check-business-integrity] Fatal error:", msg);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

