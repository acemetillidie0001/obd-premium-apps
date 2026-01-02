/**
 * Smoke Tests for OBD Scheduler
 * P1-26: Critical Paths Untested
 * 
 * Minimal E2E tests to verify critical paths work:
 * 1. Public booking page loads and shows form
 * 2. Metrics API endpoint is accessible
 */

import { test, expect } from "@playwright/test";

test.describe("OBD Scheduler Smoke Tests", () => {
  test("public booking page loads and shows form", async ({ page }) => {
    const bookingKey = process.env.BOOKING_KEY;
    
    test.skip(!bookingKey, "BOOKING_KEY environment variable is required for this test");

    await page.goto(`/book/${bookingKey}`);
    
    // Wait for page to load
    await page.waitForLoadState("networkidle");
    
    // Check that the form is visible by looking for customer name input field
    // The form uses input fields with type="text" for name and type="email" for email
    const customerNameInput = page.locator('input[type="text"]').first();
    await expect(customerNameInput).toBeVisible({ timeout: 10000 });
    
    // Check that customer email input field is visible
    const customerEmailInput = page.locator('input[type="email"]').first();
    await expect(customerEmailInput).toBeVisible({ timeout: 10000 });
    
    // Verify page has loaded content
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
  });

  test("metrics API endpoint is accessible", async ({ request, baseURL }) => {
    // Test the metrics API endpoint directly (no auth required for smoke test)
    // This endpoint requires auth, so we expect 401, but it should respond (not 500/404)
    const response = await request.get(`${baseURL}/api/obd-scheduler/metrics?range=7d`);
    
    // API should respond (even if unauthorized - 401 is expected without auth)
    // We're just checking the endpoint exists and responds
    expect([200, 401, 403]).toContain(response.status());
    
    // Verify response has JSON content-type (even for errors)
    const contentType = response.headers()["content-type"];
    if (contentType) {
      expect(contentType).toContain("application/json");
    }
    
    // If we get a response, parse it to ensure it's valid JSON
    if (response.ok() || response.status() === 401 || response.status() === 403) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });
});

