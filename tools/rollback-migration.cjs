/**
 * Rollback Migration Script
 * 
 * Safely marks a failed Prisma migration as rolled back in the _prisma_migrations table.
 * This does NOT delete data or reset the database - it only updates the migration record.
 * 
 * Usage: node tools/rollback-migration.cjs
 */

const { PrismaClient } = require("@prisma/client");

const MIGRATION_NAME = "20251225045724_add_review_request_automation_tables";

async function rollbackMigration() {
  const prisma = new PrismaClient();

  try {
    console.log(`Marking migration '${MIGRATION_NAME}' as rolled back...`);

    // Execute raw SQL to update the migration record
    // Using Prisma.$executeRawUnsafe with parameterized query
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "_prisma_migrations"
       SET rolled_back_at = NOW()
       WHERE migration_name = $1`,
      MIGRATION_NAME
    );

    if (result === 0) {
      console.log(`⚠️  No migration found with name '${MIGRATION_NAME}'`);
      console.log("   The migration may not exist or may already be marked as rolled back.");
    } else {
      console.log(`✅ Successfully marked ${result} migration(s) as rolled back.`);
    }

    // Verify the update
    const migration = await prisma.$queryRawUnsafe(
      `SELECT migration_name, rolled_back_at, finished_at
       FROM "_prisma_migrations"
       WHERE migration_name = $1`,
      MIGRATION_NAME
    );

    if (migration && migration.length > 0) {
      const record = migration[0];
      console.log("\nMigration record:");
      console.log(`  Name: ${record.migration_name}`);
      console.log(`  Rolled back at: ${record.rolled_back_at || "null"}`);
      console.log(`  Finished at: ${record.finished_at || "null"}`);
    }
  } catch (error) {
    console.error("❌ Error rolling back migration:", error);
    if (error.message) {
      console.error("   Error message:", error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log("\n✅ Prisma client disconnected.");
  }
}

// Run the script
rollbackMigration()
  .then(() => {
    console.log("\n✅ Script completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

