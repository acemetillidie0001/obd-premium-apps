#!/usr/bin/env tsx
/**
 * Test Prisma Database Connection
 * 
 * Validates that Prisma can connect to the Railway database
 */

import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

// Explicitly load .env.local (takes precedence)
config({ path: resolve(process.cwd(), ".env.local") });
// Also load .env as fallback
config({ path: resolve(process.cwd(), ".env") });

// Ensure DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in environment");
  console.error("   Make sure .env.local exists and contains DATABASE_URL");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
const hostname = new URL(dbUrl).hostname;
console.log(`📋 DATABASE_URL host: ${hostname}\n`);

if (hostname === "localhost" || hostname === "127.0.0.1") {
  console.error("❌ DATABASE_URL is pointing to localhost, not Railway");
  console.error("   Please update .env.local with the Railway DATABASE_URL");
  process.exit(1);
}

const prisma = new PrismaClient();

async function testConnection() {
  console.log("🔍 Testing Prisma database connection...\n");

  try {
    // Test connection
    await prisma.$connect();
    console.log("✅ Successfully connected to database");

    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`✅ Database is accessible (User table has ${userCount} records)`);

    // Check if SocialQueueItem table exists
    try {
      const queueCount = await prisma.socialQueueItem.count();
      console.log(`✅ SocialQueueItem table exists (${queueCount} records)`);
    } catch (err) {
      console.warn("⚠️  SocialQueueItem table may not exist or is not accessible");
    }

    console.log("\n✅ Connection test passed!");
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ Connection failed:");
      console.error(`   ${error.message}`);

      // Provide helpful error messages
      if (error.message.includes("P1001") || error.message.includes("Can't reach")) {
        console.error("\n💡 Possible fixes:");
        console.error("   1. Check DATABASE_URL in .env.local");
        console.error("   2. Ensure Railway database is running");
        console.error("   3. Verify SSL mode: ?sslmode=require");
        console.error("   4. Check network/firewall settings");
      } else if (error.message.includes("P1013") || error.message.includes("Invalid connection string")) {
        console.error("\n💡 Possible fixes:");
        console.error("   1. Verify DATABASE_URL format: postgresql://USER:PASS@HOST:PORT/DB?sslmode=require");
        console.error("   2. Check for special characters in password (may need URL encoding)");
      }
    } else {
      console.error("❌ Unexpected error:", error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();

