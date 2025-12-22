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
// We use sslmode=require in connection string + rejectUnauthorized: false in Pool config
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
