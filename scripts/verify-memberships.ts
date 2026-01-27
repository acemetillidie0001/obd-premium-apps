#!/usr/bin/env tsx
/**
 * Verify memberships for a single user by email.
 *
 * Usage:
 *   $env:VERIFY_EMAIL='you@example.com'
 *   pnpm run memberships:verify
 *
 * Notes:
 * - Prints only DB host (hostname), user id/email, and membership fields (no secrets).
 * - Attempts to detect the membership model accessor name if it differs across branches.
 */
import "dotenv/config";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing — env not loaded");
}

function getDbHostSafe(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "missing";
  try {
    return new URL(raw).hostname || "unknown";
  } catch {
    return "parse-fail";
  }
}

type JoinModelDescriptor = {
  modelName: string;
  accessorName: string;
  businessRelationField?: string;
  hasRole: boolean;
  hasStatus: boolean;
  hasCreatedAt: boolean;
};

function lowerCamelCase(modelName: string): string {
  // Prisma client accessor: ModelName -> modelName
  return modelName.length ? modelName[0]!.toLowerCase() + modelName.slice(1) : modelName;
}

function discoverUserBusinessJoinModelsFromSchema(schemaText: string): JoinModelDescriptor[] {
  const models: JoinModelDescriptor[] = [];
  const re = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  for (const match of schemaText.matchAll(re)) {
    const modelName = match[1];
    const body = match[2] ?? "";

    // Strip line comments for simpler scanning
    const lines = body
      .split(/\r?\n/g)
      .map((l) => l.replace(/\/\/.*$/g, "").trim())
      .filter(Boolean);

    const hasUserId = lines.some((l) => /^userId\b/.test(l));
    const hasBusinessId = lines.some((l) => /^businessId\b/.test(l));
    if (!hasUserId || !hasBusinessId) continue;

    const hasRole = lines.some((l) => /^role\b/.test(l));
    const hasStatus = lines.some((l) => /^status\b/.test(l));
    const hasCreatedAt = lines.some((l) => /^createdAt\b/.test(l));

    // Find a relation field pointing to Business, if present (typically: `business Business @relation(...)`)
    const businessRelationField = (() => {
      for (const l of lines) {
        const m = l.match(/^(\w+)\s+Business\b/);
        if (m?.[1]) return m[1];
      }
      return undefined;
    })();

    models.push({
      modelName,
      accessorName: lowerCamelCase(modelName),
      businessRelationField,
      hasRole,
      hasStatus,
      hasCreatedAt,
    });
  }

  return models;
}

async function main() {
  const { prisma } = await import("./_prisma");
  const verifyEmail = process.env.VERIFY_EMAIL?.trim();
  if (!verifyEmail) {
    console.error("[verify-memberships] Missing env: VERIFY_EMAIL");
    process.exitCode = 1;
    return;
  }

  console.log("[verify-memberships] DB_HOST=", getDbHostSafe());

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: verifyEmail, mode: "insensitive" } as any },
      select: { id: true, email: true },
    });

    if (!user) {
      console.error("[verify-memberships] No user found for email:", verifyEmail);
      process.exitCode = 1;
      return;
    }

    console.log("[verify-memberships] user.id=", user.id);
    console.log("[verify-memberships] user.email=", user.email);

    const schemaPath = path.resolve(process.cwd(), "prisma", "schema.prisma");
    const schemaText = fs.readFileSync(schemaPath, "utf8");
    const joinModels = discoverUserBusinessJoinModelsFromSchema(schemaText);

    const allMembershipRows: Array<{
      model: string;
      businessId: string;
      businessName?: string;
      role?: unknown;
      status?: unknown;
    }> = [];

    for (const jm of joinModels) {
      const delegate = (prisma as any)[jm.accessorName];
      if (!delegate || typeof delegate.findMany !== "function") continue;

      const select: any = { businessId: true };
      if (jm.hasRole) select.role = true;
      if (jm.hasStatus) select.status = true;
      if (jm.businessRelationField) {
        select[jm.businessRelationField] = { select: { id: true, name: true } };
      }

      const query: any = {
        where: { userId: user.id },
        select,
      };
      if (jm.hasCreatedAt) query.orderBy = [{ createdAt: "asc" }];

      const rows: any[] = await delegate.findMany(query);
      for (const r of rows) {
        const businessRel = jm.businessRelationField
          ? r[jm.businessRelationField]
          : undefined;
        allMembershipRows.push({
          model: jm.modelName,
          businessId: r.businessId,
          businessName: businessRel?.name,
          role: r.role,
          status: r.status,
        });
      }
    }

    if (allMembershipRows.length === 0) {
      console.log("NO MEMBERSHIPS FOUND FOR USER");
      return;
    }

    for (const row of allMembershipRows) {
      console.log("[verify-memberships] Membership:", {
        businessId: row.businessId,
        businessName: row.businessName ?? null,
        role: row.role ?? null,
        status: row.status ?? null,
        model: row.model,
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[verify-memberships] Failed:", msg);
    process.exitCode = 1;
  });

