#!/usr/bin/env tsx
/**
 * DATABASE_URL Validation Script
 * 
 * Diagnoses P1013 errors by validating the DATABASE_URL format
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local if it exists
config({ path: resolve(process.cwd(), ".env.local") });
// Also try .env as fallback
config({ path: resolve(process.cwd(), ".env") });

const dbUrl = process.env.DATABASE_URL;

console.log("=".repeat(60));
console.log("DATABASE_URL Validation Diagnostic");
console.log("=".repeat(60));
console.log();

if (!dbUrl) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

console.log("✅ DATABASE_URL is set");
console.log(`   Length: ${dbUrl.length} characters`);
console.log();

// Check for common issues
const issues: string[] = [];

// Check if it starts with a valid scheme
if (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
  issues.push(`❌ Invalid scheme: URL must start with "postgresql://" or "postgres://"`);
  console.log(`   First 20 chars: ${dbUrl.substring(0, 20)}`);
} else {
  console.log("✅ Valid scheme detected");
}

// Check for common malformed patterns
if (dbUrl.includes("DATABASE_URL=")) {
  issues.push("❌ URL contains 'DATABASE_URL=' prefix - remove it");
}

if (dbUrl.includes("<") || dbUrl.includes(">")) {
  issues.push("❌ URL contains placeholder characters (< or >)");
}

if (dbUrl.trim() !== dbUrl) {
  issues.push("❌ URL has leading/trailing whitespace");
}

// Check for unescaped special characters in password
const match = dbUrl.match(/postgres(ql)?:\/\/[^:]+:([^@]+)@/);
if (match) {
  const password = match[2];
  const specialChars = ["@", ":", "/", "?", "#", "[", "]"];
  const unescaped = specialChars.filter(char => password.includes(char) && !password.includes(encodeURIComponent(char)));
  
  if (unescaped.length > 0) {
    issues.push(`❌ Password contains unescaped special characters: ${unescaped.join(", ")}`);
    issues.push(`   These must be URL-encoded (e.g., @ becomes %40)`);
  }
}

// Try to parse as URL
try {
  const url = new URL(dbUrl);
  console.log("✅ URL parses correctly");
  console.log(`   Protocol: ${url.protocol}`);
  console.log(`   Hostname: ${url.hostname}`);
  console.log(`   Port: ${url.port || "default (5432)"}`);
  console.log(`   Database: ${url.pathname.substring(1)}`);
  console.log(`   Query params: ${url.search || "none"}`);
} catch (error) {
  issues.push(`❌ URL parsing failed: ${error instanceof Error ? error.message : String(error)}`);
}

// Check query parameters
if (dbUrl.includes("?")) {
  const queryString = dbUrl.split("?")[1];
  const params = new URLSearchParams(queryString);
  console.log();
  console.log("Query parameters:");
  for (const [key, value] of params.entries()) {
    console.log(`   ${key} = ${value}`);
  }
}

console.log();
console.log("=".repeat(60));

if (issues.length > 0) {
  console.log("ISSUES FOUND:");
  issues.forEach(issue => console.log(`  ${issue}`));
  console.log();
  console.log("RECOMMENDED FIX:");
  console.log("1. Go to Vercel Dashboard → Settings → Environment Variables");
  console.log("2. Edit DATABASE_URL");
  console.log("3. Ensure it starts with: postgresql://");
  console.log("4. URL-encode any special characters in the password");
  console.log("5. Remove any 'DATABASE_URL=' prefix if present");
  console.log("6. Remove any placeholder text (< >)");
  process.exit(1);
} else {
  console.log("✅ DATABASE_URL format appears valid!");
  console.log();
  console.log("If Prisma still fails, the issue may be:");
  console.log("- Database server is not accessible from Vercel");
  console.log("- SSL certificate issues");
  console.log("- Network/firewall restrictions");
  process.exit(0);
}

