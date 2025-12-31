#!/usr/bin/env tsx
/**
 * Auto-fix Failed Migration
 * 
 * Automatically resolves the failed migration by checking database state
 * and taking the appropriate action.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { execSync } from "child_process";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  console.error("Please set DATABASE_URL in .env.local");
  process.exit(1);
}

const migrationName = "20251225045724_add_review_request_automation_tables";

console.log("=".repeat(60));
console.log("Auto-fixing Failed Migration");
console.log("=".repeat(60));
console.log();
console.log(`Migration: ${migrationName}`);
console.log();

// Check if tables exist by trying to query them
console.log("Checking if Review Request tables exist...");
try {
  // Try to query one of the tables that should exist
  const checkQuery = `SELECT 1 FROM "ReviewRequestCampaign" LIMIT 1`;
  execSync(
    `npx prisma db execute --stdin <<< "${checkQuery}"`,
    { stdio: "pipe", env: process.env }
  );
  console.log("✅ Tables appear to exist - marking migration as applied");
  console.log();
  
  // Mark as applied
  execSync(
    `npx prisma migrate resolve --applied "${migrationName}"`,
    { stdio: "inherit", env: process.env }
  );
  console.log();
  console.log("✅ Migration marked as applied");
} catch (error) {
  // Tables don't exist or query failed
  console.log("⚠️  Tables don't exist or query failed - marking as rolled back");
  console.log("   This will allow the migration to retry");
  console.log();
  
  try {
    execSync(
      `npx prisma migrate resolve --rolled-back "${migrationName}"`,
      { stdio: "inherit", env: process.env }
    );
    console.log();
    console.log("✅ Migration marked as rolled back");
  } catch (resolveError) {
    console.error("❌ Failed to resolve migration:");
    console.error(resolveError instanceof Error ? resolveError.message : String(resolveError));
    process.exit(1);
  }
}

console.log();
console.log("=".repeat(60));
console.log("Now deploying remaining migrations...");
console.log("=".repeat(60));
console.log();

// Deploy remaining migrations
try {
  execSync(
    `npx prisma migrate deploy`,
    { stdio: "inherit", env: process.env }
  );
  console.log();
  console.log("✅ Migrations deployed successfully");
  console.log();
  console.log("Next: Run 'pnpm prisma generate' to regenerate Prisma client");
} catch (error) {
  console.error();
  console.error("❌ Failed to deploy migrations:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

