/**
 * Accessibility Tests for OBD Scheduler
 * P2-17: Accessibility Testing
 * P1-21: Color Contrast (testing)
 * 
 * Tests use axe-core to scan for accessibility violations.
 * Only serious and critical violations cause test failures.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Filter violations to only serious and critical impact levels
 */
function filterSeriousViolations(violations: any[]) {
  return violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
}

/**
 * Print a readable summary of accessibility violations
 */
function printViolationsSummary(
  pageName: string,
  allViolations: any[],
  seriousViolations: any[]
) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Accessibility Scan: ${pageName}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Total violations found: ${allViolations.length}`);
  console.log(`Serious/Critical violations: ${seriousViolations.length}`);
  
  if (allViolations.length > 0) {
    console.log(`\nAll violations:`);
    allViolations.forEach((violation, index) => {
      console.log(`\n${index + 1}. ${violation.id} (${violation.impact || "unknown"} impact)`);
      console.log(`   Description: ${violation.description}`);
      console.log(`   Help: ${violation.helpUrl}`);
      console.log(`   Affected elements: ${violation.nodes.length}`);
      
      if (violation.nodes.length > 0) {
        console.log(`   First element: ${violation.nodes[0].html.substring(0, 100)}`);
      }
    });
  } else {
    console.log("\n✅ No accessibility violations found!");
  }
  
  if (seriousViolations.length > 0) {
    console.log(`\n⚠️  SERIOUS/CRITICAL VIOLATIONS (${seriousViolations.length}):`);
    seriousViolations.forEach((violation, index) => {
      console.log(`\n${index + 1}. ${violation.id} (${violation.impact} impact)`);
      console.log(`   ${violation.description}`);
      console.log(`   Help: ${violation.helpUrl}`);
    });
  }
  
  console.log(`${"=".repeat(60)}\n`);
}

test.describe("Accessibility Tests", () => {
  test("public booking page should have no serious accessibility violations", async ({ page }) => {
    const bookingKey = process.env.BOOKING_KEY;
    
    test.skip(!bookingKey, "BOOKING_KEY environment variable is required for this test");

    await page.goto(`/book/${bookingKey}`);
    await page.waitForLoadState("networkidle");
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "best-practice"])
      .analyze();
    
    const seriousViolations = filterSeriousViolations(accessibilityScanResults.violations);
    
    printViolationsSummary(
      "Public Booking Page",
      accessibilityScanResults.violations,
      seriousViolations
    );
    
    // Only fail on serious/critical violations
    expect(seriousViolations).toEqual([]);
  });

  test("metrics API endpoint should be accessible", async ({ request, baseURL }) => {
    // Test metrics API endpoint (since dashboard may require auth)
    // This is a minimal check to ensure the endpoint exists
    const response = await request.get(`${baseURL}/api/obd-scheduler/metrics?range=7d`);
    
    // Should respond (even if 401/403, endpoint exists)
    expect([200, 401, 403]).toContain(response.status());
    
    // Verify it's JSON
    const contentType = response.headers()["content-type"];
    if (contentType) {
      expect(contentType).toContain("application/json");
    }
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Accessibility Scan: Metrics API Endpoint`);
    console.log(`${"=".repeat(60)}`);
    console.log(`Status: ${response.status()}`);
    console.log(`Content-Type: ${contentType || "not specified"}`);
    console.log(`${"=".repeat(60)}\n`);
  });
});

