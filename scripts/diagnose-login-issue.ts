/**
 * Diagnose login Configuration error
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

console.log("🔍 Diagnosing Login Configuration Error\n");
console.log("=" .repeat(60));

// Check environment variables
console.log("\n📋 Environment Variables:");
console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? "✅ Set" : "❌ MISSING"}`);
console.log(`  AUTH_SECRET: ${process.env.AUTH_SECRET ? `✅ Set (${process.env.AUTH_SECRET.length} chars)` : "❌ MISSING"}`);
console.log(`  AUTH_URL: ${process.env.AUTH_URL || process.env.NEXTAUTH_URL || "❌ MISSING"}`);
console.log(`  RESEND_API_KEY: ${process.env.RESEND_API_KEY ? "✅ Set" : "❌ MISSING"}`);
console.log(`  EMAIL_FROM: ${process.env.EMAIL_FROM || "❌ MISSING"}`);

// Check adapter
console.log("\n🔌 Adapter Check:");
try {
  if (process.env.NEXT_RUNTIME === "edge") {
    console.log("  ⚠️  Edge Runtime - adapter will be undefined");
  } else {
    const { PrismaAdapter } = require("@auth/prisma-adapter");
    const { prisma } = require("../src/lib/prisma");
    
    console.log("  📦 Loading PrismaAdapter...");
    const adapter = PrismaAdapter(prisma);
    console.log("  ✅ PrismaAdapter created successfully");
    
    // Test database connection (async)
    console.log("\n  🧪 Testing database connection...");
    (async () => {
      try {
        await prisma.$connect();
        console.log("  ✅ Database connection successful");
        
        // Test a simple query
        const result = await prisma.user.findFirst();
        console.log("  ✅ Database query successful");
        
        await prisma.$disconnect();
      } catch (dbError: any) {
        console.error("  ❌ Database connection failed:", dbError.message);
        console.error("     This will cause Configuration errors");
      }
    })();
  }
} catch (error: any) {
  console.error("  ❌ Adapter initialization failed:", error.message);
  console.error("     This will cause Configuration errors");
}

// Check auth config
console.log("\n⚙️  Auth Configuration:");
(async () => {
  try {
    // Dynamically import to avoid module load issues
    const authModule = await import("../src/lib/auth");
    const authConfig = authModule.authConfig;
  
  console.log(`  Adapter: ${authConfig.adapter ? "✅ Set" : "❌ Missing/Undefined"}`);
  console.log(`  Providers: ${authConfig.providers?.length || 0} configured`);
  console.log(`  Secret: ${authConfig.secret ? "✅ Set" : "❌ Missing"}`);
  console.log(`  Trust Host: ${authConfig.trustHost}`);
  
  if (!authConfig.adapter) {
    console.error("\n  ❌ PROBLEM FOUND: Adapter is missing!");
    console.error("     NextAuth v5 Email provider REQUIRES an adapter.");
    console.error("     This will cause Configuration errors.");
  }
  
  if (authConfig.providers?.length === 0) {
    console.error("\n  ❌ PROBLEM FOUND: No providers configured!");
  }
  
  } catch (error: any) {
    console.error("  ❌ Failed to load auth config:", error.message);
  }
  
      console.log("\n" + "=".repeat(60));
    console.log("\n💡 If adapter is missing, check:");
    console.log("   1. DATABASE_URL is set in .env.local");
    console.log("   2. Run: prisma generate");
    console.log("   3. Run: prisma migrate deploy (if needed)");
    console.log("   4. Restart dev server");
    console.log("\n");
})();

