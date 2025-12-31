#!/usr/bin/env tsx
/**
 * Test CRM Database Tables
 * 
 * Verifies that CRM tables exist and are accessible
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local BEFORE importing prisma (prisma checks env vars at import time)
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Now import prisma after env vars are loaded
import { prisma } from "../src/lib/prisma";

async function testTables() {
  console.log("Testing CRM database tables...\n");

  try {
    // Test 1: Database connection
    console.log("1. Testing database connection...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("   ✅ Database connection successful\n");

    // Test 2: Check if tables exist
    console.log("2. Checking if CRM tables exist...");
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('CrmContact', 'CrmTag', 'CrmContactActivity', 'CrmContactTag')
      ORDER BY table_name
    `;

    const tableNames = tables.map(t => t.table_name);
    console.log(`   Found tables: ${tableNames.length > 0 ? tableNames.join(", ") : "NONE"}\n`);

    const requiredTables = ["CrmContact", "CrmTag", "CrmContactActivity", "CrmContactTag"];
    const missing = requiredTables.filter(t => !tableNames.includes(t));

    if (missing.length > 0) {
      console.error(`   ❌ Missing tables: ${missing.join(", ")}\n`);
      console.log("   Run: pnpm prisma migrate deploy\n");
      process.exit(1);
    }

    console.log("   ✅ All required tables exist\n");

    // Test 3: Test Prisma models
    console.log("3. Testing Prisma models...");
    
    if (!prisma.crmContact) {
      console.error("   ❌ prisma.crmContact is undefined\n");
      console.log("   Run: pnpm prisma generate\n");
      process.exit(1);
    }
    console.log("   ✅ prisma.crmContact exists");

    if (!prisma.crmTag) {
      console.error("   ❌ prisma.crmTag is undefined\n");
      console.log("   Run: pnpm prisma generate\n");
      process.exit(1);
    }
    console.log("   ✅ prisma.crmTag exists\n");

    // Test 4: Try to query tables
    console.log("4. Testing table queries...");
    
    const contactCount = await prisma.crmContact.count();
    console.log(`   ✅ CrmContact.count() = ${contactCount}`);

    const tagCount = await prisma.crmTag.count();
    console.log(`   ✅ CrmTag.count() = ${tagCount}\n`);

    console.log("✅ All tests passed! Database is ready.\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("\nStack:", error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testTables();

