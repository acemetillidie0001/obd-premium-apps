#!/usr/bin/env tsx
/**
 * Test CRM API Logic
 * 
 * Simulates what the API route does to verify it will work
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local BEFORE importing prisma
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { prisma } from "../src/lib/prisma";
import { verifyCrmDatabaseSetup } from "../src/lib/apps/obd-crm/devSelfTest";

async function testApiLogic() {
  console.log("Testing CRM API Route Logic...\n");

  // Simulate what the API route does
  console.log("1. Running verifyCrmDatabaseSetup() (same as API route)...");
  const selfTest = await verifyCrmDatabaseSetup();
  
  if (!selfTest.ok) {
    console.error("❌ Self-test FAILED:");
    console.error(`   Error: ${selfTest.error}`);
    console.error(`   Code: ${selfTest.code}`);
    console.error("   Guidance:");
    selfTest.guidance.forEach(g => console.error(`     - ${g}`));
    process.exit(1);
  }
  
  console.log("   ✅ Self-test passed (same check API route uses)\n");

  // Test Prisma models (same check API route does)
  console.log("2. Testing Prisma models (same check API route uses)...");
  if (!prisma) {
    console.error("   ❌ prisma is undefined");
    process.exit(1);
  }
  if (!prisma.crmContact) {
    console.error("   ❌ prisma.crmContact is undefined");
    process.exit(1);
  }
  console.log("   ✅ Prisma models are available\n");

  // Test actual query (what API route does)
  console.log("3. Testing actual database query (what API route does)...");
  try {
    const count = await prisma.crmContact.count();
    console.log(`   ✅ Query successful - found ${count} contacts`);
  } catch (error) {
    console.error("   ❌ Query failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log("\n✅ ALL API LOGIC TESTS PASSED!");
  console.log("\nThe API route should work correctly.");
  console.log("\nIf you're still seeing errors:");
  console.log("1. Restart the dev server (stop with Ctrl+C, then run 'pnpm dev')");
  console.log("2. Hard refresh the browser (Ctrl+Shift+R)");
  console.log("3. Check browser console for any client-side errors");
  
  process.exit(0);
}

testApiLogic().finally(() => {
  prisma.$disconnect().catch(() => {});
});

