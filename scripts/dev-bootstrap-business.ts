#!/usr/bin/env tsx
/**
 * DEV-ONLY SCRIPT — DO NOT USE IN PRODUCTION
 *
 * Dev-only: One-click bootstrap for a local developer account.
 *
 * Env:
 * - DEV_EMAIL (required)
 * - BUSINESS_NAME (required)
 *
 * Flow:
 * 1) Ensure Business exists (create if missing)
 * 2) Ensure OWNER membership for DEV_EMAIL
 * 3) Print summary: userId, businessId, role
 */
import "dotenv/config";
import dotenv from "dotenv";
import path from "node:path";
import { TeamRole } from "@prisma/client";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function deriveSlugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run in production (dev-only script).");
  }

  // _prisma.ts hard-fails if DATABASE_URL is missing; keep this explicit too.
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is missing");
  }

  const devEmail = requireEnv("DEV_EMAIL");
  const businessName = requireEnv("BUSINESS_NAME");
  const businessId = deriveSlugFromName(businessName);
  if (!businessId) {
    throw new Error("Derived businessId is empty (check BUSINESS_NAME)");
  }

  const { prisma } = await import("./_prisma");
  try {
    await prisma.$connect();

    // Validate: user exists
    const user = await prisma.user.findFirst({
      where: { email: { equals: devEmail, mode: "insensitive" } as any },
      select: { id: true },
    });
    if (!user) {
      throw new Error(`No user found for DEV_EMAIL: ${devEmail}`);
    }

    // 1) Ensure Business exists
    const business =
      (await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true },
      })) ??
      (await prisma.business.create({
        data: { id: businessId, name: businessName },
        select: { id: true },
      }));

    // 2) Ensure OWNER membership
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
      select: { userId: true, businessId: true, role: true },
    });

    // 3) Print summary
    console.log(`userId=${membership.userId}`);
    console.log(`businessId=${membership.businessId}`);
    console.log(`role=${membership.role}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exitCode = 1;
});

