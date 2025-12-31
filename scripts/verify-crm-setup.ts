#!/usr/bin/env tsx
/**
 * Comprehensive CRM Setup Verification
 * 
 * Verifies all components needed for CRM to work:
 * 1. DATABASE_URL is set
 * 2. Database connection works
 * 3. Tables exist
 * 4. Prisma client is generated
 * 5. Models are accessible
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local BEFORE importing prisma
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Now import prisma after env vars are loaded
import { prisma } from "../src/lib/prisma";

async function verifySetup() {
  console.log("=".repeat(60));
  console.log("CRM Setup Verification");
  console.log("=".repeat(60));
  console.log();

  const issues: string[] = [];
  const fixes: string[] = [];

  // Check 1: DATABASE_URL
  console.log("1. Checking DATABASE_URL...");
  if (!process.env.DATABASE_URL) {
    issues.push("DATABASE_URL is not set");
    fixes.push("Add DATABASE_URL to .env.local");
    console.log("   ❌ DATABASE_URL is missing");
  } else {
    console.log("   ✅ DATABASE_URL is set");
  }
  console.log();

  // Check 2: Database connection
  console.log("2. Testing database connection...");
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("   ✅ Database connection successful");
  } catch (error) {
    issues.push("Database connection failed");
    fixes.push("Check DATABASE_URL is correct");
    fixes.push("Verify database server is running");
    console.log("   ❌ Database connection failed:", error instanceof Error ? error.message : String(error));
  }
  console.log();

  // Check 3: Tables exist
  console.log("3. Checking if CRM tables exist...");
  try {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('CrmContact', 'CrmTag', 'CrmContactActivity', 'CrmContactTag')
      ORDER BY table_name
    `;
    const tableNames = tables.map(t => t.table_name);
    const requiredTables = ["CrmContact", "CrmTag", "CrmContactActivity", "CrmContactTag"];
    const missing = requiredTables.filter(t => !tableNames.includes(t));
    
    if (missing.length > 0) {
      issues.push(`Missing tables: ${missing.join(", ")}`);
      fixes.push("Run: pnpm prisma migrate deploy");
      console.log("   ❌ Missing tables:", missing.join(", "));
    } else {
      console.log("   ✅ All required tables exist:", tableNames.join(", "));
    }
  } catch (error) {
    issues.push("Could not check tables");
    console.log("   ❌ Error checking tables:", error instanceof Error ? error.message : String(error));
  }
  console.log();

  // Check 4: Prisma models
  console.log("4. Checking Prisma models...");
  const requiredModels = [
    { name: "crmContact", displayName: "CrmContact" },
    { name: "crmTag", displayName: "CrmTag" },
  ];
  const missingModels: string[] = [];
  
  for (const model of requiredModels) {
    const modelInstance = (prisma as any)[model.name];
    if (!modelInstance || typeof modelInstance.findMany !== "function") {
      missingModels.push(model.displayName);
    }
  }
  
  if (missingModels.length > 0) {
    issues.push(`Missing Prisma models: ${missingModels.join(", ")}`);
    fixes.push("Run: pnpm prisma generate");
    console.log("   ❌ Missing models:", missingModels.join(", "));
  } else {
    console.log("   ✅ All Prisma models are available");
  }
  console.log();

  // Check 5: Test queries
  console.log("5. Testing table queries...");
  try {
    const contactCount = await prisma.crmContact.count();
    console.log(`   ✅ CrmContact.count() = ${contactCount}`);
    
    const tagCount = await prisma.crmTag.count();
    console.log(`   ✅ CrmTag.count() = ${tagCount}`);
  } catch (error) {
    issues.push("Table queries failed");
    console.log("   ❌ Query failed:", error instanceof Error ? error.message : String(error));
  }
  console.log();

  // Summary
  console.log("=".repeat(60));
  if (issues.length === 0) {
    console.log("✅ ALL CHECKS PASSED - CRM is ready to use!");
    console.log();
    console.log("If you're still seeing errors in the browser:");
    console.log("1. Restart the dev server: Stop it (Ctrl+C) and run 'pnpm dev' again");
    console.log("2. Hard refresh the browser (Ctrl+Shift+R)");
    console.log("3. Clear browser cache if needed");
    process.exit(0);
  } else {
    console.log("❌ ISSUES FOUND:");
    issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
    console.log();
    console.log("RECOMMENDED FIXES:");
    fixes.forEach((fix, i) => console.log(`   ${i + 1}. ${fix}`));
    console.log();
    console.log("After applying fixes:");
    console.log("1. Restart the dev server");
    console.log("2. Hard refresh the browser");
    process.exit(1);
  }
}

verifySetup().finally(() => {
  prisma.$disconnect().catch(() => {});
});

