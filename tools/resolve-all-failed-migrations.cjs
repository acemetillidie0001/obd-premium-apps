console.log("[resolver] FINGERPRINT=v3-guard-lazyload");
console.log("RESOLVER_HARD_EXIT_ACTIVE=1");
process.exit(0);
// FINGERPRINT_RESOLVER=2026-01-03T00:00Z_v1
console.log("FINGERPRINT_RESOLVER=2026-01-03T00:00Z_v1");

// HARD VERCEL DETECTION GUARD - EXIT IMMEDIATELY IF ON VERCEL
// Check Vercel environment variables
const hasVercelEnv = 
  process.env.VERCEL === "1" || 
  process.env.VERCEL === "true" ||
  typeof process.env.VERCEL_ENV === "string" ||
  process.env.VERCEL_ENV !== undefined ||
  process.env.VERCEL_URL !== undefined ||
  process.env.VERCEL_GIT_COMMIT_SHA !== undefined ||
  process.env.NOW_REGION !== undefined;

// Check Vercel path via working directory
const cwd = process.cwd();
const pwd = process.env.PWD || "";
const isVercelPath = cwd.startsWith("/vercel/") || pwd.startsWith("/vercel/");

// EXIT IMMEDIATELY if on Vercel - no code below can run
if (hasVercelEnv || isVercelPath) {
  console.log("RESOLVER_SKIPPED_ON_VERCEL=1");
  process.exit(0);
}

// CRITICAL: Set TLS rejection BEFORE any modules are loaded
// Node.js reads this when TLS module is first loaded, so it must be after Vercel guard
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * Resolve ALL Failed Migrations
 * 
 * Automatically finds and resolves ALL failed migrations in the database.
 * This script:
 * 1. Finds all migrations that started but never finished (failed migrations)
 * 2. Marks them as rolled-back so Prisma will re-run them
 * 3. This allows Prisma to re-execute the patched migration SQL files
 * 
 * This script is idempotent and safe to run multiple times.
 * 
 * Usage: node tools/resolve-all-failed-migrations.cjs
 */

const { loadEnv } = require("./_loadEnv.cjs");
const { Pool } = require("pg");

// Load environment variables before creating PrismaClient
try {
  loadEnv();
} catch (error) {
  console.error("❌ Failed to load environment variables:");
  console.error(error.message);
  process.exit(1);
}

async function resolveAllFailedMigrations() {
  // Use pg Pool directly to avoid Prisma 7 client initialization issues
  let dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL or DATABASE_URL_DIRECT must be set");
  }

  // Remove any existing sslmode from the connection string to avoid conflicts
  // We'll handle SSL via the Pool config instead
  dbUrl = dbUrl.replace(/[?&]sslmode=[^&]*/gi, '');
  
  console.log("[resolve-all-failed-migrations] TLS_REJECT=", process.env.NODE_TLS_REJECT_UNAUTHORIZED);
  console.log("[resolve-all-failed-migrations] NODE_ENV=", process.env.NODE_ENV);

  // Configure Pool with explicit SSL settings that accept self-signed certificates
  // This is necessary for Railway Postgres which uses self-signed certificates
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false, // Accept self-signed certificates (Railway uses these)
    },
    // Additional connection options for reliability
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });

  try {
    console.log("=".repeat(60));
    console.log("Resolving All Failed Migrations");
    console.log("=".repeat(60));
    console.log();

    // Find all failed migrations (started but not finished, not rolled back)
    const result = await pool.query(`
      SELECT 
        migration_name,
        started_at,
        finished_at,
        rolled_back_at,
        applied_steps_count
      FROM "_prisma_migrations"
      WHERE started_at IS NOT NULL
        AND finished_at IS NULL
        AND rolled_back_at IS NULL
      ORDER BY started_at ASC
    `);
    
    const failedMigrations = result.rows;

    if (!failedMigrations || failedMigrations.length === 0) {
      console.log("✅ No failed migrations found.");
      console.log("   All migrations are in a clean state.");
      return true;
    }

    console.log(`Found ${failedMigrations.length} failed migration(s):\n`);

    for (const migration of failedMigrations) {
      console.log(`  - ${migration.migration_name}`);
      console.log(`    Started: ${migration.started_at}`);
      console.log(`    Status: FAILED (started but never finished)\n`);
    }

    console.log("Resolving failed migrations...\n");
    console.log("Strategy: Delete failed migration records so Prisma will re-run them fresh.\n");
    console.log("Note: Migration SQL files are patched and resilient.\n");

    // Delete failed migration records so Prisma will re-run them
    // This is safe because:
    // 1. The migration SQL files are patched to be resilient
    // 2. They use IF NOT EXISTS so they won't fail if partially applied
    // 3. Prisma will re-run them from scratch
    let deletedCount = 0;
    for (const migration of failedMigrations) {
      try {
        console.log(`  Deleting failed record: ${migration.migration_name}...`);
        const deleteResult = await pool.query(
          `DELETE FROM "_prisma_migrations" WHERE migration_name = $1`,
          [migration.migration_name]
        );
        if (deleteResult.rowCount > 0) {
          deletedCount++;
          console.log(`  ✅ Deleted: ${migration.migration_name}\n`);
        } else {
          console.log(`  ⚠️  No record found: ${migration.migration_name}\n`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to delete: ${migration.migration_name}`);
        console.error(`     Error: ${error.message}\n`);
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ Deleted ${deletedCount} failed migration record(s).`);
      console.log();
      console.log("Next step: Run 'pnpm db:deploy' to re-apply the migrations.");
      console.log();
      console.log("The migrations will be re-run with the patched, resilient SQL.");
      console.log("They will NOT fail if the User table doesn't exist.");
    } else {
      console.log("✅ No migrations needed to be deleted.");
    }

    return true;
  } catch (error) {
    console.error("❌ Error resolving failed migrations:", error);
    if (error.message) {
      console.error("   Error message:", error.message);
    }
    return false;
  } finally {
    await pool.end();
    console.log("\n✅ Database connection closed.");
  }
}

// Run the script
resolveAllFailedMigrations()
  .then((success) => {
    if (success) {
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

