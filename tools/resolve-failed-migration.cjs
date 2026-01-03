console.log("[resolver] FINGERPRINT=v3-wrapper");
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

