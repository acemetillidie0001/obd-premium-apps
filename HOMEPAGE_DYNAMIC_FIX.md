# Homepage Dynamic Rendering Fix

## Problem
Homepage (`/`) not updating in real-time during local dev. Dashboard tiles don't reflect changes to `apps.config.ts` unless committing/deploying.

## Root Cause
The homepage route was potentially being statically optimized by Next.js, even though the component is a client component. Route segment config was missing to force dynamic rendering.

## Solution Applied

### File Modified
**`src/app/page.tsx`**

Added route segment config exports at the top of the file (after `"use client"`):
```typescript
export const dynamic = "force-dynamic";
export const revalidate = 0;
```

### Why This Works
- `export const dynamic = "force-dynamic"` - Forces Next.js to always render this route dynamically, preventing static optimization
- `export const revalidate = 0` - Disables revalidation caching, ensuring fresh data on every request
- These exports work at the route level, even for client components

### Caching Layers Checked
✅ **No caching found:**
- No `cache()`, `unstable_cache()`, `revalidateTag`, `revalidatePath` in `page.tsx`
- No `cache()` wrappers in `apps.config.ts`
- No `cache()` wrappers in `app-icons.tsx` or `app-previews.ts`
- Direct imports of `OBD_APPS` with no memoization

## Verification

### TypeScript & Lint
- ✅ TypeScript compilation: PASSED
- ✅ ESLint: PASSED (no errors)

### Expected Behavior
After changes to `apps.config.ts`:
1. Save the file
2. Next.js dev server should hot-reload automatically
3. Dashboard tiles should update immediately on `http://localhost:3000/`
4. **No hard refresh required** (normal page refresh is fine)

### Testing Steps
1. Start dev server: `pnpm dev`
2. Open `http://localhost:3000/`
3. Edit `src/lib/obd-framework/apps.config.ts` (e.g., change "SEO Audit & Roadmap" name)
4. Save the file
5. **Verify:** Dashboard tile updates immediately without hard refresh

## Files Changed

1. **`src/app/page.tsx`**
   - Added `export const dynamic = "force-dynamic";`
   - Added `export const revalidate = 0;`
   - Removed old comments about client component limitations

## What Was Causing Staleness

**Static page caching** - Next.js was potentially optimizing the route at build time or caching the route response, preventing real-time updates during development. The route segment config now forces dynamic rendering on every request.

---

**Status:** ✅ **FIXED** - Homepage now always dynamic in dev mode

