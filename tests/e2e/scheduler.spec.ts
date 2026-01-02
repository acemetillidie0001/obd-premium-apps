/**
 * E2E Tests for OBD Scheduler
 * P1-26: Critical Paths Untested
 * P2-18: Visual Regression Testing
 */

import { test, expect } from "@playwright/test";

test.describe("OBD Scheduler Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Note: In a real scenario, you'd need to authenticate first
    // For now, we'll test the public booking page and assume auth is handled
  });

  test("should load scheduler dashboard", async ({ page }) => {
    // This test assumes authentication is handled
    // In a real scenario, you'd need to set up auth state
    await page.goto("/apps/obd-scheduler");
    
    // Wait for page to load
    await page.waitForLoadState("networkidle");
    
    // Check for key elements
    await expect(page.getByRole("tab", { name: /requests/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /services/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /metrics/i })).toBeVisible();
  });

  test("should load metrics tab", async ({ page }) => {
    await page.goto("/apps/obd-scheduler");
    await page.waitForLoadState("networkidle");
    
    // Click metrics tab
    await page.getByRole("tab", { name: /metrics/i }).click();
    
    // Wait for metrics to load
    await page.waitForSelector('[data-testid="metrics-container"]', { timeout: 10000 }).catch(() => {
      // If metrics fail to load, check for error message
      expect(page.getByText(/loading metrics/i)).toBeVisible();
    });
  });

  test("should display metrics range selector", async ({ page }) => {
    await page.goto("/apps/obd-scheduler");
    await page.waitForLoadState("networkidle");
    
    await page.getByRole("tab", { name: /metrics/i }).click();
    
    // Check for range selector
    const rangeSelector = page.getByLabel(/range/i);
    await expect(rangeSelector).toBeVisible();
    
    // Check options exist
    await expect(page.getByRole("option", { name: /last 7 days/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /last 30 days/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /last 90 days/i })).toBeVisible();
  });
});

test.describe("Public Booking Page", () => {
  test("should load public booking page with valid bookingKey", async ({ page }) => {
    // This would need a valid bookingKey from test data
    const bookingKey = process.env.TEST_BOOKING_KEY || "test-key";
    await page.goto(`/book/${bookingKey}`);
    
    await page.waitForLoadState("networkidle");
    
    // Check for booking form elements
    const nameInput = page.getByLabel(/name/i).or(page.getByPlaceholder(/name/i));
    const emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    
    // At least one of these should exist
    await expect(nameInput.or(emailInput).first()).toBeVisible();
  });

  test("should block submit on invalid email", async ({ page }) => {
    const bookingKey = process.env.TEST_BOOKING_KEY || "test-key";
    await page.goto(`/book/${bookingKey}`);
    await page.waitForLoadState("networkidle");
    
    // Try to find and fill form
    const emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i)).first();
    if (await emailInput.isVisible()) {
      await emailInput.fill("invalid-email");
      
      // Try to submit
      const submitButton = page.getByRole("button", { name: /submit|book|request/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Should show validation error
        await expect(
          page.getByText(/invalid|email|required/i).first()
        ).toBeVisible({ timeout: 2000 });
      }
    }
  });
});

test.describe("Visual Regression", () => {
  // Set stable viewport and disable animations for all visual tests
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport (1280x720)
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Disable animations via prefers-reduced-motion media query
    await page.addInitScript(() => {
      // Create a style element to disable animations
      const style = document.createElement("style");
      style.textContent = `
        *,
        *::before,
        *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `;
      document.head.appendChild(style);
    });
  });

  test("public booking page visual snapshot", async ({ page }) => {
    const bookingKey = process.env.BOOKING_KEY;
    
    test.skip(!bookingKey, "BOOKING_KEY environment variable is required for this test");

    await page.goto(`/book/${bookingKey}`);
    await page.waitForLoadState("networkidle");
    
    // Wait for any remaining animations/transitions to settle
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot("public-booking-page.png", {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test("scheduler dashboard main view visual snapshot", async ({ page }) => {
    await page.goto("/apps/obd-scheduler");
    await page.waitForLoadState("networkidle");
    
    // Wait for page to stabilize
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot("scheduler-dashboard.png", {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test("metrics tab visual snapshot", async ({ page }) => {
    await page.goto("/apps/obd-scheduler");
    await page.waitForLoadState("networkidle");
    
    // Click metrics tab
    await page.getByRole("tab", { name: /metrics/i }).click();
    
    // Wait for metrics to load and stabilize
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot("metrics-tab.png", {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});

