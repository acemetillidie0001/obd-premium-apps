/**
 * Check Prisma Migrations Status
 * 
 * Inspects the _prisma_migrations table to show migration status.
 * Read-only operation - safe for production.
 * 
 * Usage: node tools/check-migrations.cjs
 */

const { loadEnv } = require("./_loadEnv.cjs");
const { PrismaClient } = require("@prisma/client");

// Load environment variables before creating PrismaClient
try {
  loadEnv();
} catch (error) {
  console.error("❌ Failed to load environment variables:");
  console.error(error.message);
  process.exit(1);
}

async function checkMigrations() {
  const prisma = new PrismaClient();

  try {
    console.log("Fetching migration status...\n");

    // Query all migrations, sorted by started_at DESC
    const migrations = await prisma.$queryRawUnsafe(`
      SELECT 
        migration_name,
        started_at,
        finished_at,
        rolled_back_at,
        applied_steps_count
      FROM "_prisma_migrations"
      ORDER BY started_at DESC
    `);

    if (!migrations || migrations.length === 0) {
      console.log("⚠️  No migrations found in the database.");
      console.log("\n✅ Migration state clean.");
      return true;
    }

    console.log(`Found ${migrations.length} migration(s):\n`);

    // Calculate column widths for table formatting
    const maxNameLength = Math.max(
      "Migration Name".length,
      ...migrations.map((m) => m.migration_name?.length || 0)
    );
    const dateWidth = 19; // ISO date format length
    const statusWidth = 12;

    // Print header
    const header = [
      "Migration Name".padEnd(maxNameLength),
      "Started At".padEnd(dateWidth),
      "Finished At".padEnd(dateWidth),
      "Rolled Back At".padEnd(dateWidth),
      "Status".padEnd(statusWidth),
      "Steps".padEnd(5),
    ].join(" | ");

    console.log(header);
    console.log("-".repeat(header.length));

    // Print each migration
    for (const migration of migrations) {
      const name = (migration.migration_name || "unknown").padEnd(maxNameLength);
      const startedAt = migration.started_at
        ? new Date(migration.started_at).toISOString().replace("T", " ").substring(0, 19)
        : "null".padEnd(dateWidth);
      const finishedAt = migration.finished_at
        ? new Date(migration.finished_at).toISOString().replace("T", " ").substring(0, 19)
        : "null".padEnd(dateWidth);
      const rolledBackAt = migration.rolled_back_at
        ? new Date(migration.rolled_back_at).toISOString().replace("T", " ").substring(0, 19)
        : "null".padEnd(dateWidth);

      // Determine status
      let status = "unknown";
      if (migration.rolled_back_at) {
        status = "ROLLED_BACK";
      } else if (migration.finished_at) {
        status = "APPLIED";
      } else if (migration.started_at) {
        status = "IN_PROGRESS";
      } else {
        status = "PENDING";
      }
      status = status.padEnd(statusWidth);

      const steps = (migration.applied_steps_count?.toString() || "0").padEnd(5);

      const row = [name, startedAt, finishedAt, rolledBackAt, status, steps].join(" | ");
      console.log(row);
    }

    // Summary statistics
    console.log("\n" + "-".repeat(header.length));
    const applied = migrations.filter((m) => m.finished_at && !m.rolled_back_at).length;
    const rolledBack = migrations.filter((m) => m.rolled_back_at).length;
    const inProgress = migrations.filter(
      (m) => m.started_at && !m.finished_at && !m.rolled_back_at
    ).length;
    const pending = migrations.filter(
      (m) => !m.started_at && !m.finished_at && !m.rolled_back_at
    ).length;

    console.log("\nSummary:");
    console.log(`  Total migrations: ${migrations.length}`);
    console.log(`  Applied: ${applied}`);
    console.log(`  Rolled back: ${rolledBack}`);
    console.log(`  In progress: ${inProgress}`);
    console.log(`  Pending: ${pending}`);

    // Check for unfinished migrations (finished_at IS NULL)
    const unfinishedMigrations = migrations.filter((m) => !m.finished_at && !m.rolled_back_at);
    
    console.log("\n" + "=".repeat(60));
    if (unfinishedMigrations.length > 0) {
      console.log(`\n❌ Found ${unfinishedMigrations.length} unfinished migration(s):`);
      unfinishedMigrations.forEach((m) => {
        console.log(`   - ${m.migration_name}`);
      });
      console.log("\n⚠️  Migration state is NOT clean.");
      return false; // Indicate failure
    } else {
      console.log("\n✅ Migration state clean.");
      return true; // Indicate success
    }
  } catch (error) {
    console.error("❌ Error checking migrations:", error);
    if (error.message) {
      console.error("   Error message:", error.message);
    }
    return false; // Indicate failure
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkMigrations()
  .then((isClean) => {
    if (isClean) {
      console.log("\n✅ Script completed successfully.");
      process.exit(0);
    } else {
      console.log("\n❌ Script completed with errors.");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

