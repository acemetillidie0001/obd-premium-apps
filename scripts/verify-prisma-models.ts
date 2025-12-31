/**
 * Dev-only Prisma model availability verification script
 * 
 * Called from dev-reset.ps1 after Prisma generate to ensure required models exist.
 * Exits with code 1 if models are missing (dev only).
 * 
 * Uses tsx to handle TypeScript imports from the src directory.
 */

// Only run in development
if (process.env.NODE_ENV === "production") {
  process.exit(0);
}

// Import the assertion function from the centralized location
import { assertPrismaModelsAvailable } from "../src/lib/dbStartupCheck";

try {
  // Run the assertion - this will throw if models are missing
  assertPrismaModelsAvailable();
  
  console.log("[Prisma Models] All required models are available");
  process.exit(0);
} catch (error) {
  // Error message is already logged by assertPrismaModelsAvailable
  process.exit(1);
}

