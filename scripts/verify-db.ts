#!/usr/bin/env tsx
/**
 * Database Verification Script
 * 
 * Verifies that the database schema includes required fields:
 * - User.role
 * - User.isPremium
 * 
 * Exits with code 0 if valid, code 1 if invalid.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyDatabase() {
  console.log("🔍 Verifying database schema...\n");

  try {
    // Check if User model exists and has required fields
    // We'll do this by attempting to query the User model with the fields
    const sampleUser = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        role: true,
        isPremium: true,
      },
    });

    // If we can select these fields, they exist
    console.log("✅ User.role field exists");
    console.log("✅ User.isPremium field exists");

    // Verify field types by checking a user (or attempting to create a test query)
    const testQuery = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name IN ('role', 'isPremium')
      ORDER BY column_name;
    `;

    const hasRole = testQuery.some((col) => col.column_name === "role");
    const hasIsPremium = testQuery.some((col) => col.column_name === "isPremium");

    if (!hasRole) {
      console.error("❌ User.role field is missing in database");
      process.exit(1);
    }

    if (!hasIsPremium) {
      console.error("❌ User.isPremium field is missing in database");
      process.exit(1);
    }

    // Check data types
    const roleField = testQuery.find((col) => col.column_name === "role");
    const premiumField = testQuery.find((col) => col.column_name === "isPremium");

    if (roleField && roleField.data_type !== "text" && roleField.data_type !== "character varying") {
      console.warn(`⚠️  User.role has unexpected type: ${roleField.data_type} (expected: text)`);
    }

    if (premiumField && premiumField.data_type !== "boolean") {
      console.warn(`⚠️  User.isPremium has unexpected type: ${premiumField.data_type} (expected: boolean)`);
    }

    console.log("\n✅ Database schema verification passed!");
    console.log("\nSchema details:");
    console.log(`  - User.role: ${roleField?.data_type || "unknown"}`);
    console.log(`  - User.isPremium: ${premiumField?.data_type || "unknown"}`);

    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      // Check for specific Prisma errors
      if (error.message.includes("Unknown column") || error.message.includes("does not exist")) {
        console.error("❌ Database schema verification failed:");
        console.error(`   ${error.message}`);
        console.error("\n💡 Run migration: npm run migrate:deploy");
        process.exit(1);
      }

      // Check if it's a connection error
      if (error.message.includes("Can't reach database") || error.message.includes("P1001")) {
        console.error("❌ Cannot connect to database:");
        console.error(`   ${error.message}`);
        console.error("\n💡 Check DATABASE_URL environment variable");
        process.exit(1);
      }
    }

    console.error("❌ Unexpected error during verification:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyDatabase();

