# Testing Guide

## Overview

This document describes the testing infrastructure for the OBD Scheduler application.

## Test Types

### Unit Tests (Vitest)

Unit tests for API routes and business logic.

**Run:**
```bash
pnpm test
```

**Watch mode:**
```bash
pnpm test --watch
```

**Coverage:**
```bash
pnpm test --coverage
```

**Location:** `src/**/*.test.ts`

### E2E Tests (Playwright)

End-to-end tests for user workflows.

**Run:**
```bash
pnpm test:e2e
```

**UI mode:**
```bash
pnpm test:e2e --ui
```

**Debug:**
```bash
pnpm test:e2e --debug
```

**Location:** `tests/e2e/`

### Accessibility Tests (Playwright + Axe)

Automated accessibility testing using axe-core.

**Run:**
```bash
pnpm test:a11y
```

**Location:** `tests/e2e/a11y.spec.ts`

### Visual Regression Tests

Screenshot-based visual regression testing using Playwright.

**Run:**
```bash
pnpm test:visual
```

**Update snapshots:**
When UI changes are intentional, update the baseline snapshots:
```bash
pnpm test:visual --update-snapshots
```

**Configuration:**
- Viewport: 1280x720 (stable, consistent sizing)
- Animations: Disabled via CSS injection (prevents flaky diffs)
- Test locations:
  - Public booking page (requires `BOOKING_KEY` env var)
  - Scheduler dashboard main view
  - Metrics tab view

**How to Update Snapshots:**

1. Make your UI changes
2. Run tests to see failures:
   ```bash
   pnpm test:visual
   ```
3. Review the diff images in `test-results/` to verify changes are intentional
4. Update snapshots if changes are correct:
   ```bash
   pnpm test:visual --update-snapshots
   ```
5. Commit the updated snapshot files along with your code changes

**Location:** `tests/e2e/scheduler.spec.ts` (Visual Regression describe block)

**Snapshot storage:** Snapshots are stored in `tests/e2e/scheduler.spec.ts-snapshots/`

### Load Tests (k6)

Performance and load testing.

**Run:**
```bash
pnpm test:load
```

See `tests/load/README.md` for detailed instructions.

## Running All Tests

```bash
# Run all tests locally
pnpm test && pnpm test:e2e && pnpm test:a11y
```

## CI/CD

Tests run automatically in CI:
- Unit tests on every commit
- E2E smoke tests on every commit
- Accessibility tests on every commit
- Visual regression on pull requests
- Load tests: Manual only (see `tests/load/README.md`)

## Test Data

### Unit Tests

Unit tests use mocked Prisma and auth contexts. No database connection required.

### E2E Tests

E2E tests require:
- Running development server (`pnpm dev`)
- Valid test data (optional, tests handle missing data gracefully)

### Load Tests

Load tests require:
- `K6_BOOKING_KEY` environment variable
- Running server (local or remote)

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, vi } from "vitest";

describe("My Feature", () => {
  it("should do something", () => {
    expect(true).toBe(true);
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from "@playwright/test";

test("should load page", async ({ page }) => {
  await page.goto("/my-page");
  await expect(page.getByRole("heading")).toBeVisible();
});
```

### Accessibility Test Example

```typescript
import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("should have no a11y violations", async ({ page }) => {
  await page.goto("/my-page");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

## Debugging Tests

### Unit Tests

```bash
# Run specific test file
pnpm test src/path/to/test.test.ts

# Run with debug output
pnpm test --reporter=verbose
```

### E2E Tests

```bash
# Run in headed mode
pnpm test:e2e --headed

# Run specific test
pnpm test:e2e tests/e2e/scheduler.spec.ts

# Debug mode (opens Playwright inspector)
pnpm test:e2e --debug
```

## Troubleshooting

### Tests fail in CI but pass locally

- Check environment variables
- Verify test data setup
- Check for timing issues (add appropriate waits)

### Visual regression tests fail

- Check viewport size matches
- Verify animations are disabled
- Update snapshots if UI changes are intentional

### Accessibility tests fail

- Review violations in test output
- Fix issues in code
- See `CONTRAST_NOTES.md` for color contrast issues

## Best Practices

1. **Keep tests fast**: Unit tests should be < 1s, E2E < 30s
2. **Use stable selectors**: Prefer `data-testid` over CSS classes
3. **Mock external dependencies**: Don't hit real APIs in unit tests
4. **Clean up test data**: E2E tests should clean up after themselves
5. **Test user workflows**: E2E tests should reflect real user behavior

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Axe Core Documentation](https://github.com/dequelabs/axe-core)
- [k6 Documentation](https://k6.io/docs/)

