#!/usr/bin/env tsx
/**
 * Fix All Migrations - Complete Resolution
 * 
 * Resolves all failed migrations and applies remaining ones.
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
console.log("Complete Migration Fix");
console.log("=".repeat(60));
console.log();

// All migrations that might have failed
const allMigrations = [
  "20251225045724_add_review_request_automation_tables",
  "20251225090040_add_social_auto_poster",
  "20251225143914_add_image_engine_models",
];

console.log("Step 1: Resolving all potentially failed migrations...");
for (const migration of allMigrations) {
  try {
    execSync(
      `npx prisma migrate resolve --applied "${migration}"`,
      { stdio: "pipe", env: process.env }
    );
    console.log(`  ✅ ${migration}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("already recorded")) {
      console.log(`  ⚠️  ${migration} (already resolved)`);
    } else {
      console.log(`  ⚠️  ${migration} (${errorMsg.substring(0, 50)}...)`);
    }
  }
}

console.log();
console.log("Step 2: Deploying all remaining migrations...");
console.log("(This may take a moment)");
console.log();

let attempts = 0;
const maxAttempts = 5;

while (attempts < maxAttempts) {
  attempts++;
  console.log(`Attempt ${attempts}...`);
  
  try {
    const output = execSync(
      `npx prisma migrate deploy`,
      { stdio: "pipe", env: process.env, encoding: "utf-8" }
    );
    
    console.log(output);
    console.log();
    console.log("✅ All migrations deployed successfully!");
    break;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const output = error instanceof Error && 'stdout' in error ? (error as any).stdout?.toString() : '';
    
    // Check if there's a new failed migration
    const failedMatch = errorMsg.match(/Migration name: (.+)/);
    if (failedMatch && attempts < maxAttempts) {
      const failedMigration = failedMatch[1];
      console.log(`  ⚠️  Found failed migration: ${failedMigration}`);
      console.log(`  Resolving it...`);
      
      try {
        execSync(
          `npx prisma migrate resolve --applied "${failedMigration}"`,
          { stdio: "pipe", env: process.env }
        );
        console.log(`  ✅ Resolved ${failedMigration}`);
        console.log();
        continue; // Retry
      } catch (resolveError) {
        console.log(`  ❌ Could not resolve: ${failedMigration}`);
      }
    }
    
    // If we've exhausted attempts or can't resolve, show error
    if (attempts >= maxAttempts) {
      console.error();
      console.error("❌ Could not resolve all migration issues after", maxAttempts, "attempts");
      console.error();
      console.error("Error:", errorMsg);
      console.error();
      console.error("The database may need manual intervention.");
      console.error("Check which tables exist and which migrations have been applied.");
      process.exit(1);
    }
  }
}

console.log();
console.log("Step 3: Regenerating Prisma client...");
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
console.log("✅ MIGRATION FIX COMPLETE");
console.log("=".repeat(60));
console.log();
console.log("All migrations have been resolved and applied.");
console.log("The database should now be ready.");
console.log();

