import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getDatabaseUrl } from "./dbUrl";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Get normalized database URL (ensures sslmode=require and connection_limit=1)
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
