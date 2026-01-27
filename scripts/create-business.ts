#!/usr/bin/env tsx
/**
 * DEV-ONLY SCRIPT — DO NOT USE IN PRODUCTION
 *
 * Dev-only: Create a Business row by name/slug (id).
 *
 * Env:
 * - DATABASE_URL (required)
 * - BUSINESS_NAME (required)
 * - BUSINESS_SLUG (optional; derived from name if missing)
 */
import "dotenv/config";
import dotenv from "dotenv";
import path from "node:path";

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

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing");
  }

  const businessName = requireEnv("BUSINESS_NAME");
  const businessSlug =
    process.env.BUSINESS_SLUG?.trim() || deriveSlugFromName(businessName);

  if (!businessSlug) {
    throw new Error("BUSINESS_SLUG resolved to an empty value");
  }

  const { prisma } = await import("./_prisma");
  try {
    // 1) Connect Prisma
    await prisma.$connect();

    // 2) Check if a Business with this name already exists
    const existingByName = await prisma.business.findFirst({
      where: { name: businessName },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (existingByName) {
      console.log(existingByName.id);
      return;
    }

    // (Extra safety) If the slug/id already exists, treat as already created.
    const existingById = await prisma.business.findUnique({
      where: { id: businessSlug },
      select: { id: true },
    });
    if (existingById) {
      console.log(existingById.id);
      return;
    }

    // 3) Create Business row with name + slug (stored as id)
    const created = await prisma.business.create({
      data: { id: businessSlug, name: businessName },
      select: { id: true, name: true },
    });

    // 4) Print
    console.log("BUSINESS CREATED:");
    console.log(`id=${created.id}`);
    console.log(`name=${created.name ?? ""}`);
    console.log(`slug=${businessSlug}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exitCode = 1;
});

