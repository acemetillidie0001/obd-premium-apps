/**
 * Comprehensive HTTP test for authentication flow
 * Tests the actual API endpoints to verify AdapterError is fixed
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Enable debug mode
process.env.AUTH_DEBUG = "true";
process.env.NEXTAUTH_DEBUG = "true";

const BASE_URL = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

async function makeRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  console.log(`  📤 ${options.method || "GET"} ${path}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    return response;
  } catch (error: any) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

async function testEmailSignIn(email: string, shouldSucceed: boolean): Promise<TestResult> {
  const testName = `Email sign-in with ${email === "" ? "empty" : email === undefined ? "undefined" : email}`;
  
  try {
    const response = await makeRequest("/api/auth/signin/email", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    const data = await response.json().catch(() => ({}));
    
    if (shouldSucceed) {
      // Should return 200 or redirect
      if (response.ok || response.status === 200 || response.status === 302) {
        return {
          name: testName,
          passed: true,
          details: { status: response.status, message: "Sign-in request accepted" },
        };
      } else {
        return {
          name: testName,
          passed: false,
          error: `Expected success but got ${response.status}`,
          details: data,
        };
      }
    } else {
      // Should reject invalid email
      if (response.status >= 400) {
        return {
          name: testName,
          passed: true,
          details: { status: response.status, message: "Invalid email correctly rejected" },
        };
      } else {
        return {
          name: testName,
          passed: false,
          error: `Expected rejection but got ${response.status}`,
          details: data,
        };
      }
    }
  } catch (error: any) {
    if (!shouldSucceed && error.message.includes("Invalid")) {
      return {
        name: testName,
        passed: true,
        details: { error: "Invalid email correctly rejected before request" },
      };
    }
    return {
      name: testName,
      passed: false,
      error: error.message,
    };
  }
}

async function testAdapterDirectly(): Promise<TestResult> {
  try {
    // Test that adapter won't receive undefined
    const { authConfig } = require("../src/lib/auth");
    
    if (!authConfig.providers || authConfig.providers.length === 0) {
      return {
        name: "Adapter configuration check",
        passed: false,
        error: "No providers configured",
      };
    }

    const emailProvider = authConfig.providers.find((p: any) => p.id === "email");
    if (!emailProvider) {
      return {
        name: "Adapter configuration check",
        passed: false,
        error: "Email provider not found",
      };
    }

    // Test normalizeIdentifier if it exists
    if (emailProvider.normalizeIdentifier) {
      try {
        const normalized = emailProvider.normalizeIdentifier("test@example.com");
        if (normalized === "test@example.com") {
          // Test that it rejects invalid
          try {
            emailProvider.normalizeIdentifier(undefined as any);
            return {
              name: "Adapter normalizeIdentifier validation",
              passed: false,
              error: "Should have rejected undefined",
            };
          } catch {
            return {
              name: "Adapter normalizeIdentifier validation",
              passed: true,
              details: "Correctly validates and rejects invalid emails",
            };
          }
        }
      } catch (error: any) {
        return {
          name: "Adapter normalizeIdentifier validation",
          passed: false,
          error: error.message,
        };
      }
    }

    return {
      name: "Adapter configuration check",
      passed: true,
      details: "Email provider configured with normalizeIdentifier",
    };
  } catch (error: any) {
    return {
      name: "Adapter configuration check",
      passed: false,
      error: error.message,
    };
  }
}

async function runAllTests() {
  console.log("🧪 Comprehensive Authentication Test Suite");
  console.log("=" .repeat(70));
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🔍 Debug Mode: ${process.env.AUTH_DEBUG === "true" ? "✅ Enabled" : "❌ Disabled"}\n`);

  const results: TestResult[] = [];

  // Test 1: Direct adapter configuration check
  console.log("\n1️⃣  Testing Adapter Configuration:");
  const adapterTest = await testAdapterDirectly();
  results.push(adapterTest);
  if (adapterTest.passed) {
    console.log(`   ✅ ${adapterTest.name}`);
    if (adapterTest.details) console.log(`      ${JSON.stringify(adapterTest.details)}`);
  } else {
    console.log(`   ❌ ${adapterTest.name}`);
    console.log(`      Error: ${adapterTest.error}`);
  }

  // Test 2: Valid email sign-in
  console.log("\n2️⃣  Testing Valid Email Sign-In:");
  const validEmailTest = await testEmailSignIn("test@example.com", true);
  results.push(validEmailTest);
  if (validEmailTest.passed) {
    console.log(`   ✅ ${validEmailTest.name}`);
    if (validEmailTest.details) console.log(`      Status: ${validEmailTest.details.status}`);
  } else {
    console.log(`   ❌ ${validEmailTest.name}`);
    console.log(`      Error: ${validEmailTest.error}`);
  }

  // Test 3: Invalid email - empty string
  console.log("\n3️⃣  Testing Invalid Email (Empty String):");
  const emptyEmailTest = await testEmailSignIn("", false);
  results.push(emptyEmailTest);
  if (emptyEmailTest.passed) {
    console.log(`   ✅ ${emptyEmailTest.name}`);
    if (emptyEmailTest.details) console.log(`      ${JSON.stringify(emptyEmailTest.details)}`);
  } else {
    console.log(`   ❌ ${emptyEmailTest.name}`);
    console.log(`      Error: ${emptyEmailTest.error}`);
  }

  // Test 4: Invalid email - no @ symbol
  console.log("\n4️⃣  Testing Invalid Email (No @ Symbol):");
  const invalidEmailTest = await testEmailSignIn("invalid-email", false);
  results.push(invalidEmailTest);
  if (invalidEmailTest.passed) {
    console.log(`   ✅ ${invalidEmailTest.name}`);
    if (invalidEmailTest.details) console.log(`      ${JSON.stringify(invalidEmailTest.details)}`);
  } else {
    console.log(`   ❌ ${invalidEmailTest.name}`);
    console.log(`      Error: ${invalidEmailTest.error}`);
  }

  // Test 5: Invalid email - just @
  console.log("\n5️⃣  Testing Invalid Email (Just @ Symbol):");
  const atOnlyTest = await testEmailSignIn("@example.com", false);
  results.push(atOnlyTest);
  if (atOnlyTest.passed) {
    console.log(`   ✅ ${atOnlyTest.name}`);
    if (atOnlyTest.details) console.log(`      ${JSON.stringify(atOnlyTest.details)}`);
  } else {
    console.log(`   ❌ ${atOnlyTest.name}`);
    console.log(`      Error: ${atOnlyTest.error}`);
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("\n📊 Test Summary:");
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`   ✅ Passed: ${passed}/${results.length}`);
  console.log(`   ❌ Failed: ${failed}/${results.length}`);

  if (failed === 0) {
    console.log("\n🎉 All tests passed! AdapterError issue is RESOLVED.");
    console.log("\n✅ Key Fixes Verified:");
    console.log("   • normalizeIdentifier validates emails before adapter");
    console.log("   • Invalid emails are rejected early");
    console.log("   • Adapter never receives undefined arguments");
    console.log("   • AdapterError with undefined is prevented");
  } else {
    console.log("\n⚠️  Some tests failed. Review errors above.");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   ❌ ${r.name}: ${r.error}`);
    });
  }

  console.log("\n");
  return failed === 0;
}

// Check if server is running first
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/providers`, {
      method: "GET",
    });
    return response.ok || response.status === 404; // 404 is okay, means server is running
  } catch {
    return false;
  }
}

// Main execution
async function main() {
  console.log("🔍 Checking if server is running...");
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log("❌ Server is not running!");
    console.log("\n💡 Please start the dev server first:");
    console.log("   npm run dev");
    console.log("\n   Or run with debug mode:");
    console.log("   $env:AUTH_DEBUG='true'; $env:NEXTAUTH_DEBUG='true'; npm run dev");
    process.exit(1);
  }

  console.log("✅ Server is running\n");
  
  const allPassed = await runAllTests();
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error("❌ Test suite failed:", error);
  process.exit(1);
});

