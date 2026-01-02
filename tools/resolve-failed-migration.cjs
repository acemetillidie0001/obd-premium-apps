/**
 * Resolve ALL Failed Migrations (Automatic)
 * 
 * This script automatically finds and resolves ALL failed migrations.
 * It marks them as rolled-back so Prisma will re-run them with the patched SQL.
 * 
 * Usage: node tools/resolve-failed-migration.cjs
 */

const { loadEnv } = require("./_loadEnv.cjs");

// Load environment variables
try {
  loadEnv();
} catch (error) {
  console.error("❌ Failed to load environment variables:");
  console.error(error.message);
  process.exit(1);
}

// Delegate to the comprehensive script
require("./resolve-all-failed-migrations.cjs");

