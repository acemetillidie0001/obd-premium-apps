#!/usr/bin/env tsx
/**
 * DEV-ONLY SCRIPT — DO NOT USE IN PRODUCTION
 *
 * Manual rescue: grant a membership (kill shot).
 *
 * Usage:
 *   $env:GRANT_EMAIL='you@example.com'
 *   $env:GRANT_BUSINESS_ID='some-business-id'
 *   pnpm run memberships:grant
 *
 * Notes:
 * - Deterministic and safe to re-run (uses upsert on (businessId,userId)).
 * - Prints only required fields (no secrets).
 */
import "dotenv/config";
import dotenv from "dotenv";
import path from "node:path";
import { TeamRole } from "@prisma/client";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing — env not loaded");
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const { prisma } = await import("./_prisma");
  try {
    // Load required inputs
    const grantEmail = requireEnv("GRANT_EMAIL");
    const grantBusinessId = requireEnv("GRANT_BUSINESS_ID");

    // DB connectivity check
    await prisma.$queryRaw`SELECT 1`;

    // Validate: user exists (case-insensitive)
    const user = await prisma.user.findFirst({
      where: { email: { equals: grantEmail, mode: "insensitive" } as any },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new Error(`No user found for GRANT_EMAIL: ${grantEmail}`);
    }

    // Validate: business exists
    const business = await prisma.business.findUnique({
      where: { id: grantBusinessId },
      select: { id: true, name: true },
    });
    if (!business) {
      throw new Error(`No business found for GRANT_BUSINESS_ID: ${grantBusinessId}`);
    }

    // Upsert BusinessUser with role=OWNER, status=ACTIVE
    const membership = await prisma.businessUser.upsert({
      where: {
        businessId_userId: { businessId: business.id, userId: user.id },
      },
      create: {
        businessId: business.id,
        userId: user.id,
        role: TeamRole.OWNER,
        status: "ACTIVE",
      },
      update: {
        role: TeamRole.OWNER,
        status: "ACTIVE",
      },
      select: {
        userId: true,
        businessId: true,
        role: true,
        status: true,
      },
    });

    console.log("MEMBERSHIP GRANTED");
    console.log(`userId=${membership.userId}`);
    console.log(`businessId=${membership.businessId}`);
    console.log(`role=${membership.role}`);
    console.log(`status=${membership.status}`);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exitCode = 1;
  });

