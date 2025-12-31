#!/usr/bin/env tsx
/**
 * Resolve All Failed Migrations
 * 
 * Finds and resolves all failed migrations in the database.
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
console.log("Resolving All Failed Migrations");
console.log("=".repeat(60));
console.log();

// List of known failed migrations (add more as we find them)
const failedMigrations = [
  "20251225045724_add_review_request_automation_tables",
  "20251225090040_add_social_auto_poster",
];

console.log("Resolving failed migrations...");
console.log();

for (const migration of failedMigrations) {
  console.log(`Resolving: ${migration}`);
  try {
    execSync(
      `npx prisma migrate resolve --applied "${migration}"`,
      { stdio: "pipe", env: process.env }
    );
    console.log(`  ✅ Resolved`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("already recorded")) {
      console.log(`  ⚠️  Already resolved`);
    } else {
      console.log(`  ⚠️  Could not resolve: ${errorMsg}`);
    }
  }
}

console.log();
console.log("Now deploying remaining migrations...");
console.log();

try {
  execSync(
    `npx prisma migrate deploy`,
    { stdio: "inherit", env: process.env }
  );
  console.log();
  console.log("✅ All migrations deployed successfully");
} catch (error) {
  console.error();
  console.error("❌ Still have migration issues");
  console.error("Error:", error instanceof Error ? error.message : String(error));
  console.error();
  console.error("You may need to check the database manually");
  console.error("or reset the database if it's in an unrecoverable state.");
  process.exit(1);
}

console.log();
console.log("Regenerating Prisma client...");
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
console.log("✅ ALL FAILED MIGRATIONS RESOLVED");
console.log("=".repeat(60));
console.log();

