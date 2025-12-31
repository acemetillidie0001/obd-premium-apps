import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getDatabaseUrl } from "./dbUrl";
import { requireDatabaseUrl } from "./db/requireDatabaseUrl";
import "./dbStartupCheck"; // Run startup checks when Prisma is imported

/**
 * Prisma Client for Runtime (Next.js Application)
 * 
 * IMPORTANT: This uses DATABASE_URL (not DATABASE_URL_DIRECT).
 * 
 * - Runtime may use prisma+postgres:// (Accelerate/Data Proxy) or direct postgresql://
 * - Prisma CLI operations (migrations, studio) use DATABASE_URL_DIRECT from schema.prisma
 * - This separation allows using Accelerate in production while maintaining CLI tool compatibility
 * 
 * See prisma/schema.prisma for Prisma CLI configuration (uses DATABASE_URL_DIRECT).
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Require DATABASE_URL to be set (fail fast with friendly error if missing)
requireDatabaseUrl();

// Get normalized database URL from DATABASE_URL (runtime connection)
// Ensures sslmode=require and connection_limit=1 for serverless environments
const connectionString = getDatabaseUrl();

// Configure Pool with SSL for Railway Postgres
// Railway requires SSL but uses self-signed certificates
// CRITICAL: We must set rejectUnauthorized: false to accept self-signed certificates
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Accept self-signed certificates (Railway uses these)
  },
  // Additional SSL options to ensure connection works
  max: 1, // Match connection_limit=1 from connection string
});

// Create adapter with the pool
const adapter = new PrismaPg(pool);

// Verify adapter is created correctly
if (!adapter) {
  throw new Error("Failed to create PrismaPg adapter");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
