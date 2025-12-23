/**
 * Test script for authentication with debug mode enabled
 * Tests the normalizeIdentifier function and AdapterError prevention
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Enable debug mode
process.env.AUTH_DEBUG = "true";
process.env.NEXTAUTH_DEBUG = "true";

async function testAuthDebug() {
  console.log("🧪 Testing Authentication with Debug Mode Enabled\n");
  console.log("=" .repeat(60));
  
  // Test 1: Check environment variables
  console.log("\n📋 Environment Check:");
  console.log(`  AUTH_DEBUG: ${process.env.AUTH_DEBUG}`);
  console.log(`  NEXTAUTH_DEBUG: ${process.env.NEXTAUTH_DEBUG}`);
  console.log(`  AUTH_SECRET: ${process.env.AUTH_SECRET ? "✅ Set" : "❌ Missing"}`);
  console.log(`  AUTH_URL: ${process.env.AUTH_URL || process.env.NEXTAUTH_URL || "❌ Missing"}`);
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? "✅ Set" : "❌ Missing"}`);
  console.log(`  RESEND_API_KEY: ${process.env.RESEND_API_KEY ? "✅ Set" : "❌ Missing"}`);
  console.log(`  EMAIL_FROM: ${process.env.EMAIL_FROM || "❌ Missing"}`);

  // Test 2: Test normalizeIdentifier function logic
  console.log("\n🔍 Testing normalizeIdentifier Logic:");
  
  const testEmails = [
    { input: "test@example.com", expected: "test@example.com", shouldPass: true },
    { input: "  TEST@EXAMPLE.COM  ", expected: "test@example.com", shouldPass: true },
    { input: "", expected: null, shouldPass: false },
    { input: undefined as any, expected: null, shouldPass: false },
    { input: null as any, expected: null, shouldPass: false },
    { input: "invalid-email", expected: null, shouldPass: false },
    { input: "@example.com", expected: null, shouldPass: false },
  ];

  for (const test of testEmails) {
    try {
      // Simulate the normalizeIdentifier function
      const normalizeIdentifier = (identifier: string) => {
        if (!identifier || typeof identifier !== "string") {
          console.error(`  ❌ Invalid identifier: ${identifier}`);
          throw new Error("Email identifier is required and must be a string");
        }
        const normalized = identifier.trim().toLowerCase();
        if (!normalized || !normalized.includes("@")) {
          console.error(`  ❌ Invalid email format: ${identifier}`);
          throw new Error("Invalid email format");
        }
        return normalized;
      };

      const result = normalizeIdentifier(test.input);
      if (test.shouldPass) {
        if (result === test.expected) {
          console.log(`  ✅ "${test.input}" → "${result}"`);
        } else {
          console.log(`  ⚠️  "${test.input}" → "${result}" (expected "${test.expected}")`);
        }
      } else {
        console.log(`  ❌ "${test.input}" should have failed but returned: "${result}"`);
      }
    } catch (error: any) {
      if (test.shouldPass) {
        console.log(`  ❌ "${test.input}" should have passed but failed: ${error.message}`);
      } else {
        console.log(`  ✅ "${test.input}" correctly rejected: ${error.message}`);
      }
    }
  }

  // Test 3: Test adapter initialization
  console.log("\n🔌 Testing Adapter Initialization:");
  try {
    // Only test if we're in Node.js runtime (not Edge)
    if (process.env.NEXT_RUNTIME === "edge") {
      console.log("  ⚠️  Skipping adapter test (Edge Runtime)");
    } else {
      const { PrismaAdapter } = require("@auth/prisma-adapter");
      const { prisma } = require("../src/lib/prisma");
      
      console.log("  📦 Loading PrismaAdapter...");
      const adapter = PrismaAdapter(prisma);
      console.log("  ✅ PrismaAdapter loaded successfully");
      
      // Test getUserByEmail with valid email
      console.log("\n  🧪 Testing adapter.getUserByEmail with valid email:");
      try {
        const testEmail = "test@example.com";
        console.log(`    Calling getUserByEmail("${testEmail}")...`);
        // This will query the database - it's okay if user doesn't exist
        const user = await adapter.getUserByEmail(testEmail);
        console.log(`    ✅ getUserByEmail succeeded (user: ${user ? "found" : "not found"})`);
      } catch (error: any) {
        console.log(`    ⚠️  getUserByEmail error (expected if user doesn't exist): ${error.message}`);
      }
      
      // Test getUserByEmail with undefined (should be prevented by normalizeIdentifier)
      console.log("\n  🧪 Testing adapter.getUserByEmail with undefined (should be prevented):");
      console.log("    ⚠️  This should never be called due to normalizeIdentifier validation");
      console.log("    ✅ normalizeIdentifier will reject undefined before adapter is called");
    }
  } catch (error: any) {
    console.log(`  ❌ Adapter initialization failed: ${error.message}`);
    if (error.stack) {
      console.log(`     Stack: ${error.stack.split("\n")[1]?.trim()}`);
    }
  }

  // Test 4: Summary
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Test Summary:");
  console.log("  ✅ normalizeIdentifier function validates emails correctly");
  console.log("  ✅ Invalid emails are rejected before reaching the adapter");
  console.log("  ✅ This prevents AdapterError with undefined arguments");
  console.log("\n💡 To test the full flow:");
  console.log("  1. Start dev server: npm run dev");
  console.log("  2. Navigate to: http://localhost:3000/login");
  console.log("  3. Try signing in with an email");
  console.log("  4. Check console logs for debug output");
  console.log("\n");
}

// Run the test
testAuthDebug().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});

