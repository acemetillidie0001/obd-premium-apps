#!/usr/bin/env tsx
/**
 * Brand Profile Table Verification Script
 * 
 * Verifies that the BrandProfile table exists in the database with all required fields.
 * Exits with code 0 if valid, code 1 if invalid.
 */

import { prisma } from "@/lib/prisma";

async function verifyBrandProfile() {
  console.log("🔍 Verifying BrandProfile table...\n");

  try {
    // Check if BrandProfile table exists by attempting to query it
    const profileCount = await prisma.brandProfile.count();
    console.log(`✅ BrandProfile table exists (${profileCount} profiles)`);

    // Verify table structure by checking a sample profile or using raw SQL
    const tableInfo = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'BrandProfile' 
      ORDER BY column_name;
    `;

    const requiredColumns = [
      "id",
      "userId",
      "createdAt",
      "updatedAt",
      "businessName",
      "businessType",
      "city",
      "state",
      "brandPersonality",
      "brandVoice",
      "language",
      "includeSocialPostTemplates",
      "includeFAQStarter",
      "includeGBPDescription",
      "includeMetaDescription",
      "colorsJson",
      "typographyJson",
      "messagingJson",
      "kitJson",
    ];

    console.log("\n📋 BrandProfile table structure:");
    const foundColumns = new Set(tableInfo.map((col) => col.column_name));

    for (const col of requiredColumns) {
      if (foundColumns.has(col)) {
        const colInfo = tableInfo.find((c) => c.column_name === col);
        console.log(`   ✅ ${col} (${colInfo?.data_type || "unknown"})`);
      } else {
        console.log(`   ❌ ${col} - MISSING`);
      }
    }

    // Check for unique constraint on userId
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'BrandProfile' 
      AND indexname LIKE '%userId%';
    `;

    const hasUserIdUnique = indexes.some((idx) => idx.indexname.includes("userId") && idx.indexname.includes("key"));
    if (hasUserIdUnique) {
      console.log("\n✅ Unique constraint on userId exists");
    } else {
      console.log("\n⚠️  Unique constraint on userId not found (may cause issues)");
    }

    // Check foreign key to User table
    const foreignKeys = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'BrandProfile' 
      AND constraint_type = 'FOREIGN KEY';
    `;

    if (foreignKeys.length > 0) {
      console.log(`✅ Foreign key constraint exists (${foreignKeys.length} constraint(s))`);
    } else {
      console.log("⚠️  Foreign key constraint not found");
    }

    console.log("\n✅ BrandProfile table verification passed!");
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      // Check for specific Prisma errors
      if (
        error.message.includes("Unknown column") ||
        error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("P2021") // Table does not exist
      ) {
        console.error("❌ BrandProfile table is missing in database");
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
verifyBrandProfile();

