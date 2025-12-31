#!/usr/bin/env tsx
/**
 * Resolve Failed Prisma Migration (P3009)
 * 
 * This script helps resolve failed migrations in production.
 * 
 * Usage:
 *   pnpm tsx scripts/resolve-failed-migration.ts [--mark-applied|--mark-rolled-back]
 * 
 * Options:
 *   --mark-applied: Mark the failed migration as applied (use if tables already exist)
 *   --mark-rolled-back: Mark the failed migration as rolled back (use if you want to retry)
 */

import { config } from "dotenv";
import { resolve } from "path";
import { execSync } from "child_process";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const args = process.argv.slice(2);
const markApplied = args.includes("--mark-applied");
const markRolledBack = args.includes("--mark-rolled-back");

if (!markApplied && !markRolledBack) {
  console.log("=".repeat(60));
  console.log("Prisma Migration Resolution Helper");
  console.log("=".repeat(60));
  console.log();
  console.log("This script helps resolve failed migrations (P3009 error).");
  console.log();
  console.log("The failed migration is:");
  console.log("  20251225045724_add_review_request_automation_tables");
  console.log();
  console.log("This migration creates:");
  console.log("  - ReviewRequestCampaign table");
  console.log("  - ReviewRequestCustomer table");
  console.log("  - ReviewRequestQueueItem table");
  console.log("  - ReviewRequestDataset table");
  console.log("  - UsageCounter table");
  console.log("  - Several enums and indexes");
  console.log();
  console.log("OPTIONS:");
  console.log();
  console.log("1. Mark as Applied (--mark-applied)");
  console.log("   Use this if the tables already exist in the database.");
  console.log("   This tells Prisma the migration succeeded.");
  console.log();
  console.log("2. Mark as Rolled Back (--mark-rolled-back)");
  console.log("   Use this if you want to retry the migration.");
  console.log("   This tells Prisma the migration was rolled back.");
  console.log();
  console.log("USAGE:");
  console.log("  pnpm tsx scripts/resolve-failed-migration.ts --mark-applied");
  console.log("  pnpm tsx scripts/resolve-failed-migration.ts --mark-rolled-back");
  console.log();
  console.log("⚠️  WARNING: Only run this if you're sure about the database state!");
  console.log();
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  console.error("Set DATABASE_URL in .env.local or environment variables");
  process.exit(1);
}

const migrationName = "20251225045724_add_review_request_automation_tables";

try {
  if (markApplied) {
    console.log(`Marking migration "${migrationName}" as applied...`);
    execSync(
      `npx prisma migrate resolve --applied "${migrationName}"`,
      { stdio: "inherit", env: process.env }
    );
    console.log();
    console.log("✅ Migration marked as applied");
    console.log();
    console.log("Next steps:");
    console.log("1. Verify the tables exist in your database");
    console.log("2. Run: pnpm run migrate:deploy");
    console.log("3. This should now apply any remaining migrations");
  } else if (markRolledBack) {
    console.log(`Marking migration "${migrationName}" as rolled back...`);
    execSync(
      `npx prisma migrate resolve --rolled-back "${migrationName}"`,
      { stdio: "inherit", env: process.env }
    );
    console.log();
    console.log("✅ Migration marked as rolled back");
    console.log();
    console.log("Next steps:");
    console.log("1. Verify the tables do NOT exist (or manually drop them if they do)");
    console.log("2. Run: pnpm run migrate:deploy");
    console.log("3. This will retry the migration");
  }
} catch (error) {
  console.error();
  console.error("❌ Failed to resolve migration:");
  console.error(error instanceof Error ? error.message : String(error));
  console.error();
  console.error("Manual resolution:");
  console.error("1. Connect to your database");
  console.error("2. Check the _prisma_migrations table");
  console.error("3. Update the failed migration record manually");
  process.exit(1);
}

