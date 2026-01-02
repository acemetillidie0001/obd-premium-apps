/**
 * Environment Variable Loader
 * 
 * Reliably loads environment variables from .env files for local scripts.
 * Loads .env first, then .env.local (which overrides .env values).
 * 
 * Usage:
 *   const { loadEnv } = require('./_loadEnv.cjs');
 *   loadEnv();
 */

const path = require("path");
const fs = require("fs");

/**
 * Load environment variables from .env files
 * 
 * Loads in order:
 * 1. .env (if exists)
 * 2. .env.local (if exists, overrides .env)
 * 
 * Throws an error if DATABASE_URL is missing after loading.
 */
function loadEnv() {
  const rootDir = path.resolve(__dirname, "..");
  const envPath = path.join(rootDir, ".env");
  const envLocalPath = path.join(rootDir, ".env.local");

  // Load .env if it exists
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
  }

  // Load .env.local if it exists (overrides .env)
  if (fs.existsSync(envLocalPath)) {
    require("dotenv").config({ path: envLocalPath, override: true });
  }

  // Verify DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set.\n\n" +
      "Please set DATABASE_URL in one of the following:\n" +
      "  - .env file\n" +
      "  - .env.local file (recommended for local development)\n" +
      "  - Environment variable\n\n" +
      "Example:\n" +
      "  DATABASE_URL=postgresql://user:password@localhost:5432/dbname"
    );
  }
}

module.exports = { loadEnv };

