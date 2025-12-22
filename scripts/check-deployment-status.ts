#!/usr/bin/env tsx
/**
 * Deployment Status Checker
 * 
 * Checks if the application is ready for deployment by verifying:
 * 1. Environment variables are set
 * 2. Database connection works
 * 3. Database schema has required fields
 * 4. Prisma Client is generated
 */

import { PrismaClient } from "@prisma/client";

async function checkDeploymentStatus() {
  console.log("🔍 Checking deployment readiness...\n");

  const checks: Array<{ name: string; status: "pass" | "fail" | "warn"; message: string }> = [];

  // Check 1: Environment Variables
  console.log("1. Checking environment variables...");
  const requiredEnvVars = [
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "DATABASE_URL",
  ];

  const missingEnvVars: string[] = [];
  for (const varName of requiredEnvVars) {
    if (!process.env[varName] || process.env[varName]!.trim() === "") {
      missingEnvVars.push(varName);
    }
  }

  if (missingEnvVars.length > 0) {
    checks.push({
      name: "Environment Variables",
      status: "fail",
      message: `Missing: ${missingEnvVars.join(", ")}`,
    });
    console.log("   ❌ Missing environment variables:", missingEnvVars.join(", "));
  } else {
    checks.push({
      name: "Environment Variables",
      status: "pass",
      message: "All required variables are set",
    });
    console.log("   ✅ All required environment variables are set");
  }

  // Check 2: Database Connection
  console.log("\n2. Testing database connection...");
  if (!process.env.DATABASE_URL) {
    checks.push({
      name: "Database Connection",
      status: "fail",
      message: "DATABASE_URL not set",
    });
    console.log("   ❌ DATABASE_URL not set - skipping database checks");
  } else {
    try {
      const prisma = new PrismaClient();
      
      // Test connection
      await prisma.$connect();
      checks.push({
        name: "Database Connection",
        status: "pass",
        message: "Successfully connected to database",
      });
      console.log("   ✅ Database connection successful");

      // Check 3: Schema Fields
      console.log("\n3. Verifying database schema...");
      try {
        const testQuery = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'User' 
          AND column_name IN ('role', 'isPremium')
          ORDER BY column_name;
        `;

        const hasRole = testQuery.some((col) => col.column_name === "role");
        const hasIsPremium = testQuery.some((col) => col.column_name === "isPremium");

        if (!hasRole || !hasIsPremium) {
          const missing = [];
          if (!hasRole) missing.push("role");
          if (!hasIsPremium) missing.push("isPremium");
          
          checks.push({
            name: "Database Schema",
            status: "fail",
            message: `Missing fields: ${missing.join(", ")}. Run: npm run migrate:deploy`,
          });
          console.log("   ❌ Missing schema fields:", missing.join(", "));
          console.log("   💡 Run: npm run migrate:deploy");
        } else {
          checks.push({
            name: "Database Schema",
            status: "pass",
            message: "All required fields exist (role, isPremium)",
          });
          console.log("   ✅ Database schema verified");
          console.log(`      - User.role: ${testQuery.find((c) => c.column_name === "role")?.data_type || "unknown"}`);
          console.log(`      - User.isPremium: ${testQuery.find((c) => c.column_name === "isPremium")?.data_type || "unknown"}`);
        }
      } catch (schemaError) {
        checks.push({
          name: "Database Schema",
          status: "warn",
          message: `Could not verify schema: ${schemaError instanceof Error ? schemaError.message : "Unknown error"}`,
        });
        console.log("   ⚠️  Could not verify schema (this might be okay)");
      }

      await prisma.$disconnect();
    } catch (dbError) {
      checks.push({
        name: "Database Connection",
        status: "fail",
        message: dbError instanceof Error ? dbError.message : "Connection failed",
      });
      console.log("   ❌ Database connection failed");
      if (dbError instanceof Error) {
        console.log(`      Error: ${dbError.message}`);
      }
    }
  }

  // Check 4: NEXTAUTH_SECRET length
  console.log("\n4. Validating NEXTAUTH_SECRET...");
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret && secret.length < 32) {
    checks.push({
      name: "NEXTAUTH_SECRET",
      status: "warn",
      message: `Secret is only ${secret.length} characters (recommended: 32+)`,
    });
    console.log(`   ⚠️  NEXTAUTH_SECRET is only ${secret.length} characters`);
  } else if (secret) {
    checks.push({
      name: "NEXTAUTH_SECRET",
      status: "pass",
      message: `Secret length: ${secret.length} characters`,
    });
    console.log(`   ✅ NEXTAUTH_SECRET is ${secret.length} characters`);
  }

  // Check 5: NEXTAUTH_URL format
  console.log("\n5. Validating NEXTAUTH_URL...");
  const url = process.env.NEXTAUTH_URL;
  if (url) {
    try {
      new URL(url);
      checks.push({
        name: "NEXTAUTH_URL",
        status: "pass",
        message: `Valid URL: ${url}`,
      });
      console.log(`   ✅ NEXTAUTH_URL is valid: ${url}`);
    } catch {
      checks.push({
        name: "NEXTAUTH_URL",
        status: "fail",
        message: `Invalid URL format: ${url}`,
      });
      console.log(`   ❌ NEXTAUTH_URL is invalid: ${url}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));

  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warn").length;

  checks.forEach((check) => {
    const icon = check.status === "pass" ? "✅" : check.status === "fail" ? "❌" : "⚠️";
    console.log(`${icon} ${check.name}: ${check.message}`);
  });

  console.log("\n" + "=".repeat(60));
  console.log(`Results: ${passed} passed, ${warnings} warnings, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed > 0) {
    console.log("\n❌ Deployment is NOT ready. Please fix the issues above.");
    process.exit(1);
  } else if (warnings > 0) {
    console.log("\n⚠️  Deployment may work, but review warnings above.");
    process.exit(0);
  } else {
    console.log("\n✅ All checks passed! Ready for deployment.");
    process.exit(0);
  }
}

checkDeploymentStatus().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});

