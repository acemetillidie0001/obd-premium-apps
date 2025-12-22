import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Ensure connection string has SSL mode for Railway Postgres
// Railway requires SSL but uses self-signed certificates
// Use sslmode=no-verify to accept self-signed certificates
if (!connectionString.includes("sslmode=")) {
  const separator = connectionString.includes("?") ? "&" : "?";
  connectionString = `${connectionString}${separator}sslmode=no-verify`;
} else if (connectionString.includes("sslmode=require")) {
  // Replace sslmode=require with sslmode=no-verify to accept self-signed certs
  connectionString = connectionString.replace(/sslmode=require/g, "sslmode=no-verify");
}

// Configure Pool with SSL for Railway Postgres
// Railway requires SSL but uses self-signed certificates
// Both connection string sslmode=no-verify AND Pool ssl config are needed
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Accept self-signed certificates (Railway uses these)
  },
});
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
