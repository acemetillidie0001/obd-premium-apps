/**
 * Environment Variable Validation
 * 
 * Validates required environment variables at runtime and provides
 * a typed interface for accessing them throughout the application.
 * 
 * Throws clear errors if required variables are missing.
 * 
 * Note: Validation only runs at runtime, not during build time,
 * to allow builds to proceed without env vars (they'll be set in Vercel).
 */

interface EnvConfig {
  // NextAuth.js
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;
  
  // Resend Email Service
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  
  // Admin Bypass (optional in production)
  PREMIUM_BYPASS_KEY?: string;
  
  // Database
  DATABASE_URL: string;
}

/**
 * Validates and returns environment variables
 * Throws error if required variables are missing
 * 
 * Only validates at runtime (not during build/static generation)
 */
function validateEnv(): EnvConfig {
  // Skip validation during build/static generation
  // Environment variables will be available at runtime in Vercel
  const isBuildTime = process.env.NEXT_PHASE === "phase-production-build" ||
                      process.env.NEXT_PHASE === "phase-development-build" ||
                      typeof window === "undefined" && !process.env.DATABASE_URL;

  if (isBuildTime) {
    // Return placeholder values during build
    // Actual validation happens at runtime
    return {
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "",
      RESEND_API_KEY: process.env.RESEND_API_KEY || "",
      EMAIL_FROM: process.env.EMAIL_FROM || "",
      PREMIUM_BYPASS_KEY: process.env.PREMIUM_BYPASS_KEY,
      DATABASE_URL: process.env.DATABASE_URL || "",
    };
  }

  // Runtime validation
  const required: Array<keyof EnvConfig> = [
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "DATABASE_URL",
  ];

  const missing: string[] = [];

  for (const key of required) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const errorMessage = `
❌ Missing required environment variables:

${missing.map((key) => `  - ${key}`).join("\n")}

Please set these variables in:
  - .env.local (for local development)
  - Vercel Project Settings → Environment Variables (for production)

See docs/VERCEL_ENV_SETUP.md for detailed instructions.
    `.trim();

    throw new Error(errorMessage);
  }

  // Validate NEXTAUTH_SECRET length (should be at least 32 characters)
  const secret = process.env.NEXTAUTH_SECRET!;
  if (secret.length < 32) {
    throw new Error(
      `NEXTAUTH_SECRET must be at least 32 characters long. Current length: ${secret.length}`
    );
  }

  // Validate NEXTAUTH_URL format
  const url = process.env.NEXTAUTH_URL!;
  try {
    new URL(url);
  } catch {
    throw new Error(
      `NEXTAUTH_URL must be a valid URL. Current value: ${url}`
    );
  }

  // Validate EMAIL_FROM format (basic email check)
  const emailFrom = process.env.EMAIL_FROM!;
  if (!emailFrom.includes("@")) {
    throw new Error(
      `EMAIL_FROM must be a valid email address. Current value: ${emailFrom}`
    );
  }

  return {
    NEXTAUTH_SECRET: secret,
    NEXTAUTH_URL: url,
    RESEND_API_KEY: process.env.RESEND_API_KEY!,
    EMAIL_FROM: emailFrom,
    PREMIUM_BYPASS_KEY: process.env.PREMIUM_BYPASS_KEY,
    DATABASE_URL: process.env.DATABASE_URL!,
  };
}

// Validate on module load (fails fast at runtime if env vars are missing)
export const env = validateEnv();

// Export individual getters for convenience
export const getEnv = () => env;

// Re-export for backward compatibility
export default env;

