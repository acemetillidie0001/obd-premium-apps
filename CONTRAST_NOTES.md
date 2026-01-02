# Color Contrast Notes

## Overview

This document describes how to run accessibility checks and how color contrast is evaluated in the OBD Scheduler application.

## Running Accessibility Checks

### Quick Start

```bash
# Run all accessibility tests
pnpm test:a11y

# With environment variables
BOOKING_KEY=your-key-here pnpm test:a11y
```

### Environment Variables

- `BOOKING_KEY` (required): The booking key for testing the public booking page
- `BASE_URL` (optional): Base URL for tests (defaults to `http://localhost:3000`)

### What Gets Tested

The accessibility tests (`tests/e2e/a11y.spec.ts`) scan:

1. **Public Booking Page** (`/book/{BOOKING_KEY}`)
   - Full axe scan for WCAG 2.1 AA compliance
   - Only serious/critical violations cause test failures
   - All violations are logged for review

2. **Metrics API Endpoint**
   - Basic connectivity check (endpoint exists and responds)

## How Color Contrast is Evaluated

### Testing Tools

Color contrast is evaluated using:

1. **@axe-core/playwright** (Primary)
   - Automated WCAG 2.1 AA compliance checks
   - Scans during E2E tests
   - Reports violations with impact levels (minor, moderate, serious, critical)

2. **Lighthouse** (Optional, for manual testing)
   - Can be run via Chrome DevTools
   - Provides contrast ratio calculations
   - Useful for detailed analysis

### WCAG 2.1 AA Standards

The application targets WCAG 2.1 Level AA compliance:

- **Normal text** (smaller than 18pt regular or 14pt bold): Minimum 4.5:1 contrast ratio
- **Large text** (18pt+ regular or 14pt+ bold): Minimum 3:1 contrast ratio
- **UI components** (buttons, form controls, etc.): Minimum 3:1 contrast ratio

### Violation Impact Levels

Axe-core categorizes violations by impact:

- **Critical**: Blocks users from completing tasks
- **Serious**: Makes tasks difficult or impossible for many users
- **Moderate**: Makes tasks more difficult for some users
- **Minor**: Minor usability issues

**Current Configuration**: Tests fail only on **serious** and **critical** violations. All violations are logged for review.

### Reading Test Results

When you run `pnpm test:a11y`, you'll see:

1. **Console Summary**: Readable output showing:
   - Total violations found
   - Number of serious/critical violations
   - Details for each violation (ID, description, help URL, affected elements)

2. **Test Status**: 
   - ✅ Pass: No serious/critical violations
   - ❌ Fail: One or more serious/critical violations found

Example output:
```
============================================================
Accessibility Scan: Public Booking Page
============================================================
Total violations found: 2
Serious/Critical violations: 1

All violations:

1. color-contrast (moderate impact)
   Description: Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds
   Help: https://dequeuniversity.com/rules/axe/4.7/color-contrast
   Affected elements: 3

⚠️  SERIOUS/CRITICAL VIOLATIONS (1):

1. color-contrast (serious impact)
   Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds
   Help: https://dequeuniversity.com/rules/axe/4.7/color-contrast
============================================================
```

## Known Issues

### None Currently Identified

As of the initial implementation, no color contrast violations have been identified. If issues are found:

1. Check the specific element and its background in the violation details
2. Verify the contrast ratio meets WCAG 2.1 AA standards
3. Update the color tokens in the theme configuration
4. Re-run tests to verify the fix

## Color Tokens

The application uses Tailwind CSS with custom color tokens. Key colors:

- **Primary**: `#29c4a9` (teal/green)
- **Background**: Light mode uses white/slate, dark mode uses slate-900
- **Text**: Light mode uses gray-700, dark mode uses slate-200

## Fixing Contrast Issues

If a contrast issue is identified:

1. **Identify the problematic element**: Check the axe violation details (HTML selector, contrast ratio)
2. **Determine required contrast ratio**: Based on text size and role (see WCAG standards above)
3. **Calculate new color**: Use a contrast checker tool (see Resources below)
4. **Update color tokens**: Modify the theme configuration in:
   - `src/lib/obd-framework/theme.ts` (if custom theme system)
   - Tailwind config or component styles (if using Tailwind defaults)
5. **Re-run tests**: Verify the fix resolves the issue: `pnpm test:a11y`
6. **Update this document**: Add the issue and resolution to the Known Issues section

### Example Fix

If a button has insufficient contrast:

```tsx
// Before (insufficient contrast - 2.8:1 ratio)
className="bg-gray-300 text-gray-400"

// After (meets WCAG AA - 4.6:1 ratio)
className="bg-gray-600 text-white"
```

## Using Lighthouse for Detailed Analysis

For manual testing and detailed contrast analysis:

1. Open Chrome DevTools (F12)
2. Go to the "Lighthouse" tab
3. Select "Accessibility" category
4. Run the audit
5. Review "Color contrast is sufficient" section
6. Click on specific elements to see contrast ratios

Lighthouse provides:
- Exact contrast ratios (e.g., "4.52:1")
- Visual highlighting of problematic elements
- Suggestions for color adjustments

## Resources

- **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **WCAG 2.1 Contrast Guidelines**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- **Axe Core Rules**: https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md
- **Color Contrast Analyzer (Chrome Extension)**: Available in Chrome Web Store
- **Contrast Ratio Calculator**: https://contrast-ratio.com/

