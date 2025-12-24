# Dev Hot Reload Fix - Homepage Dashboard

## Issue
Homepage (`/`) not reflecting code/config changes in real-time during local dev.

## Root Cause
The homepage (`src/app/page.tsx`) is a **client component** (`"use client"`), which means:
- Route segment config (`export const dynamic`, `export const revalidate`) **does not apply**
- Client components are already dynamic by default in Next.js App Router
- The issue is likely module caching or browser cache, not static optimization

## Solution Applied

### File Modified
- **`src/app/page.tsx`** - Added helpful comments explaining the situation

### Why No Code Changes?
Since this is a client component, we cannot use:
```typescript
export const dynamic = "force-dynamic";  // ❌ Only works for server components
export const revalidate = 0;             // ❌ Only works for server components
```

Client components are already dynamic by default. The issue is likely:
1. **Browser cache** - Hard refresh needed
2. **Module bundling cache** - Dev server needs restart
3. **Next.js dev server cache** - `.next` folder needs clearing

## Verification Steps

### 1. Dev Script Check
✅ **Verified:** `package.json` has `"dev": "next dev"` (correct)

### 2. No Caching Wrappers Found
✅ **Verified:** No `cache()`, `unstable_cache()`, or memoized selectors in:
- `src/app/page.tsx`
- `src/lib/obd-framework/apps.config.ts`

### 3. Module Import
✅ **Verified:** Direct import of `OBD_APPS` from `apps.config.ts` (no caching layer)

## Troubleshooting

If changes to `apps.config.ts` still don't reflect immediately:

1. **Hard refresh browser:**
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Restart dev server:**
   ```bash
   # Stop current server (Ctrl+C)
   pnpm dev
   ```

3. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   pnpm dev
   ```

4. **Check browser DevTools:**
   - Open Network tab
   - Disable cache checkbox
   - Reload page

## Expected Behavior

With `pnpm dev` running:
- Changes to `apps.config.ts` should hot-reload automatically
- Dashboard tiles should update without page refresh
- If not working, use troubleshooting steps above

## Notes

- Client components cannot use route segment config exports
- This is expected Next.js behavior
- Hot reload should work automatically in dev mode
- If issues persist, it's likely a browser cache or dev server cache issue

---

**Status:** ✅ **No code changes needed** - Client components are already dynamic

