#!/usr/bin/env tsx
/**
 * Test API Endpoint Directly
 * 
 * Simulates what happens when the API route is called
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local - Next.js does this automatically, but we need it for this test
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Import after env vars are loaded
import { prisma } from "../src/lib/prisma";
import { verifyCrmDatabaseSetup } from "../src/lib/apps/obd-crm/devSelfTest";

async function testEndpoint() {
  console.log("Testing API Endpoint Logic...\n");
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "undefined"}`);
  console.log(`DATABASE_URL present: ${process.env.DATABASE_URL ? "YES" : "NO"}\n`);

  // Step 1: Self-test (what API route does first)
  console.log("Step 1: Running verifyCrmDatabaseSetup()...");
  const selfTest = await verifyCrmDatabaseSetup();
  
  if (!selfTest.ok) {
    console.error("❌ Self-test FAILED - This is why the API returns 500:");
    console.error(`   Error: ${selfTest.error}`);
    console.error(`   Code: ${selfTest.code}`);
    console.error("   Guidance:");
    selfTest.guidance.forEach(g => console.error(`     - ${g}`));
    console.error("\n⚠️  The dev server needs to be restarted to pick up DATABASE_URL!");
    process.exit(1);
  }
  
  console.log("   ✅ Self-test passed\n");

  // Step 2: Check Prisma (what API route does next)
  console.log("Step 2: Checking Prisma client...");
  if (!prisma) {
    console.error("   ❌ prisma is undefined");
    process.exit(1);
  }
  if (!prisma.crmContact) {
    console.error("   ❌ prisma.crmContact is undefined");
    console.error("   Run: pnpm prisma generate");
    process.exit(1);
  }
  console.log("   ✅ Prisma client is ready\n");

  // Step 3: Test actual query
  console.log("Step 3: Testing database query...");
  try {
    const count = await prisma.crmContact.count();
    console.log(`   ✅ Query successful - ${count} contacts found\n`);
  } catch (error) {
    console.error("   ❌ Query failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("✅ ALL TESTS PASSED - API endpoint should work!");
  console.log("=".repeat(60));
  console.log("\nIf you're still seeing errors in the browser:");
  console.log("1. ⚠️  RESTART THE DEV SERVER:");
  console.log("   - Press Ctrl+C in the terminal running 'pnpm dev'");
  console.log("   - Wait for it to fully stop");
  console.log("   - Run 'pnpm dev' again");
  console.log("2. Hard refresh browser (Ctrl+Shift+R)");
  console.log("3. Clear browser cache if needed");
  console.log("\nThe dev server MUST be restarted to load DATABASE_URL from .env.local");
  
  process.exit(0);
}

testEndpoint().catch((error) => {
  console.error("\n❌ Test failed:", error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error("\nStack:", error.stack);
  }
  process.exit(1);
}).finally(() => {
  prisma.$disconnect().catch(() => {});
});

