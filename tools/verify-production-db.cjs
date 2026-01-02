/**
 * Verify Production Database
 * 
 * Runs comprehensive checks on the production database:
 * - Checks migration status
 * - Verifies critical tables exist
 * 
 * Usage: node tools/verify-production-db.cjs
 */

const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");
const path = require("path");

const REQUIRED_TABLES = {
  user: ["User"],
  reviewRequest: [
    "ReviewRequestCampaign",
    "ReviewRequestCustomer",
    "ReviewRequestQueueItem",
    "ReviewRequestDataset",
  ],
  scheduler: [
    "BookingService",
    "BookingSettings",
    "BookingRequest",
    "AvailabilityWindow",
    "SchedulerCalendarConnection",
  ],
};

async function verifyProductionDb() {
  const prisma = new PrismaClient();
  const results = {
    migrations: false,
    tables: {
      user: false,
      reviewRequest: false,
      scheduler: false,
    },
  };

  try {
    console.log("=".repeat(60));
    console.log("Production Database Verification");
    console.log("=".repeat(60));
    console.log();

    // Step 1: Check migrations
    console.log("Step 1: Checking migration status...");
    try {
      const checkMigrationsPath = path.join(__dirname, "check-migrations.cjs");
      const output = execSync(`node "${checkMigrationsPath}"`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      
      // Check if output contains "Migration state clean"
      if (output.includes("Migration state clean")) {
        console.log("  ✅ Migration state clean");
        results.migrations = true;
      } else {
        console.log("  ❌ Unfinished migrations found");
        console.log(output);
        results.migrations = false;
      }
    } catch (error) {
      // check-migrations.cjs exits with non-zero if migrations are not clean
      const output = error.stdout?.toString() || error.message || "";
      console.log("  ❌ Migration check failed");
      if (output) {
        console.log(output);
      }
      results.migrations = false;
    }
    console.log();

    // Step 2: Verify tables exist
    console.log("Step 2: Verifying required tables exist...");
    
    // Get all existing tables
    const existingTables = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tableNames = existingTables.map((t) => t.table_name);

    // Check User table
    console.log("  Checking User table...");
    const userTables = REQUIRED_TABLES.user.filter((t) => tableNames.includes(t));
    if (userTables.length === REQUIRED_TABLES.user.length) {
      console.log(`    ✅ Found: ${userTables.join(", ")}`);
      results.tables.user = true;
    } else {
      const missing = REQUIRED_TABLES.user.filter((t) => !tableNames.includes(t));
      console.log(`    ❌ Missing: ${missing.join(", ")}`);
      results.tables.user = false;
    }

    // Check ReviewRequest tables
    console.log("  Checking ReviewRequest tables...");
    const reviewRequestTables = REQUIRED_TABLES.reviewRequest.filter((t) =>
      tableNames.includes(t)
    );
    if (reviewRequestTables.length === REQUIRED_TABLES.reviewRequest.length) {
      console.log(`    ✅ Found: ${reviewRequestTables.join(", ")}`);
      results.tables.reviewRequest = true;
    } else {
      const missing = REQUIRED_TABLES.reviewRequest.filter(
        (t) => !tableNames.includes(t)
      );
      console.log(`    ❌ Missing: ${missing.join(", ")}`);
      results.tables.reviewRequest = false;
    }

    // Check Scheduler tables
    console.log("  Checking Scheduler tables...");
    const schedulerTables = REQUIRED_TABLES.scheduler.filter((t) =>
      tableNames.includes(t)
    );
    if (schedulerTables.length === REQUIRED_TABLES.scheduler.length) {
      console.log(`    ✅ Found: ${schedulerTables.join(", ")}`);
      results.tables.scheduler = true;
    } else {
      const missing = REQUIRED_TABLES.scheduler.filter(
        (t) => !tableNames.includes(t)
      );
      console.log(`    ❌ Missing: ${missing.join(", ")}`);
      results.tables.scheduler = false;
    }

    console.log();

    // Summary
    console.log("=".repeat(60));
    console.log("Summary");
    console.log("=".repeat(60));
    
    const allChecksPass =
      results.migrations &&
      results.tables.user &&
      results.tables.reviewRequest &&
      results.tables.scheduler;

    if (allChecksPass) {
      console.log("✅ PASS - All checks passed");
      console.log("  ✓ Migrations clean");
      console.log("  ✓ User table exists");
      console.log("  ✓ ReviewRequest tables exist");
      console.log("  ✓ Scheduler tables exist");
      return true;
    } else {
      console.log("❌ FAIL - Some checks failed");
      if (!results.migrations) {
        console.log("  ✗ Migration check failed");
      }
      if (!results.tables.user) {
        console.log("  ✗ User table missing");
      }
      if (!results.tables.reviewRequest) {
        console.log("  ✗ ReviewRequest tables missing");
      }
      if (!results.tables.scheduler) {
        console.log("  ✗ Scheduler tables missing");
      }
      return false;
    }
  } catch (error) {
    console.error("❌ Error verifying database:", error);
    if (error.message) {
      console.error("   Error message:", error.message);
    }
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
verifyProductionDb()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

