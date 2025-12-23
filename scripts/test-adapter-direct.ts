// @ts-nocheck
/**
 * Direct test of PrismaAdapter to see if it works outside of NextAuth
 * This will help us determine if the issue is with the adapter or NextAuth itself
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "../src/lib/prisma";

async function testAdapter() {
  console.log("=== DIRECT ADAPTER TEST ===");
  console.log("");
  
  try {
    // 1. Check Prisma client
    console.log("1. Checking Prisma client...");
    console.log("   Prisma defined:", !!prisma);
    console.log("   Has user model:", !!prisma.user);
    console.log("   Has account model:", !!prisma.account);
    console.log("   Has session model:", !!prisma.session);
    console.log("   Has verificationToken model:", !!prisma.verificationToken);
    
    // 2. Create adapter
    console.log("\n2. Creating PrismaAdapter...");
    const adapter = PrismaAdapter(prisma);
    console.log("   Adapter created:", !!adapter);
    console.log("   Has getUserByEmail:", typeof adapter.getUserByEmail === "function");
    
    // 3. Test getUserByEmail with a test email
    console.log("\n3. Testing getUserByEmail...");
    const testEmail = "test@example.com";
    console.log("   Calling getUserByEmail with:", testEmail);
    
    try {
      const user = await adapter.getUserByEmail(testEmail);
      console.log("   ✅ getUserByEmail SUCCESS");
      console.log("   Result:", user ? "User found" : "User not found (expected)");
    } catch (error: any) {
      console.error("   ❌ getUserByEmail FAILED");
      console.error("   Error:", {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack?.split("\n").slice(0, 10).join("\n"),
      });
      throw error;
    }
    
    // 4. Test database connection directly
    console.log("\n4. Testing database connection...");
    try {
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      console.log("   ✅ Database connection SUCCESS");
      console.log("   Result:", result);
    } catch (error: any) {
      console.error("   ❌ Database connection FAILED");
      console.error("   Error:", {
        message: error?.message,
        code: error?.code,
        name: error?.name,
      });
      throw error;
    }
    
    console.log("\n=== ALL TESTS PASSED ===");
    console.log("The adapter works correctly. The issue must be in NextAuth configuration.");
    
  } catch (error: any) {
    console.error("\n=== TEST FAILED ===");
    console.error("This is the root cause of the Configuration error:");
    console.error({
      message: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack,
    });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAdapter();

