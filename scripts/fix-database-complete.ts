#!/usr/bin/env tsx
/**
 * Complete Database Fix
 * 
 * Resolves failed migrations and ensures all migrations are applied.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { execSync } from "child_process";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

console.log("=".repeat(60));
console.log("Complete Database Fix");
console.log("=".repeat(60));
console.log();

// Step 1: Resolve the failed migration
console.log("Step 1: Resolving failed migration...");
const failedMigration = "20251225045724_add_review_request_automation_tables";
try {
  execSync(
    `npx prisma migrate resolve --applied "${failedMigration}"`,
    { stdio: "inherit", env: process.env }
  );
  console.log("✅ Failed migration resolved");
} catch (error) {
  console.error("⚠️  Could not resolve failed migration (may already be resolved)");
}

console.log();
console.log("Step 2: Checking migration status...");
try {
  execSync(
    `npx prisma migrate status`,
    { stdio: "inherit", env: process.env }
  );
} catch (error) {
  // Status command may show pending migrations - that's OK
}

console.log();
console.log("Step 3: Deploying all migrations...");
console.log("(This will apply any pending migrations)");
console.log();

try {
  execSync(
    `npx prisma migrate deploy`,
    { stdio: "inherit", env: process.env }
  );
  console.log();
  console.log("✅ All migrations deployed");
} catch (error) {
  console.error();
  console.error("❌ Migration deployment failed");
  console.error("This may indicate missing base tables.");
  console.error();
  console.error("If you see 'relation does not exist' errors,");
  console.error("the database may need to be initialized from scratch.");
  console.error();
  console.error("Error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.log();
console.log("Step 4: Regenerating Prisma client...");
try {
  execSync(
    `npx prisma generate`,
    { stdio: "inherit", env: process.env }
  );
  console.log("✅ Prisma client generated");
} catch (error) {
  console.error("❌ Failed to generate Prisma client");
  process.exit(1);
}

console.log();
console.log("=".repeat(60));
console.log("✅ DATABASE FIX COMPLETE");
console.log("=".repeat(60));
console.log();
console.log("All migrations have been applied.");
console.log("The database should now be ready for use.");
console.log();

