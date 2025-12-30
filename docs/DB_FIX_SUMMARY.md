# Database Connectivity Fix Summary

## Problem

- Prisma Studio showed "No tables found"
- App intermittently treated logged-in users as non-premium
- Root cause: Environment variable mismatch and/or migrations not applied

## Solution

### Single Source of Truth for DATABASE_URL

**Before:** Prisma CLI read `.env`, Next.js read `.env.local` (mismatch)

**After:** Both read from:
1. `.env` (loaded first, lower priority)
2. `.env.local` (loaded second, overrides `.env` - Next.js convention)

**Priority:** `.env.local` > `.env`

This ensures Prisma CLI and Next.js runtime use the same `DATABASE_URL`.

---

## Files Modified

### 1. `prisma.config.ts`
- **Change:** Now loads from both `.env` and `.env.local`
- **Impact:** Prisma CLI (migrate, studio) and Next.js runtime use same `DATABASE_URL`

### 2. `src/lib/dbStartupCheck.ts` (NEW)
- **Purpose:** Non-blocking startup checks
- **Checks:**
  - DATABASE_URL presence (logs YES/NO, never the value)
  - Database connection
  - Migration status (checks if `User` table exists)
- **Impact:** Early detection of DB issues without blocking app startup

### 3. `src/lib/premium.ts`
- **Changes:**
  - Added `hasPremiumAccessSafe()` - returns structured result
  - Differentiates "not premium" vs "unable to verify" (DB unavailable)
  - Added `isMetaReviewMode()` - allows connection testing when DB unavailable
- **Impact:** Premium gate no longer silently fails when DB is unavailable

### 4. `src/lib/prisma.ts`
- **Change:** Imports `dbStartupCheck` to run checks on server boot
- **Impact:** Startup checks run automatically when Prisma is initialized

### 5. `src/app/apps/social-auto-poster/setup/page.tsx`
- **Change:** Added Meta review mode banner when DB unavailable
- **Impact:** Meta App Review testing not blocked by DB failures

### 6. `docs/DB_BOOTSTRAP_GUIDE.md` (NEW)
- **Purpose:** Comprehensive guide for database setup and troubleshooting
- **Content:**
  - Environment variable setup
  - Migration procedures
  - Prisma Studio troubleshooting
  - Verification steps

### 7. `docs/meta/review-readiness-checklist.md`
- **Change:** Added database verification section
- **Impact:** Ensures Meta App Review testing includes DB health checks

---

## How This Prevents Future Regressions

### 1. **Startup Assertions**
- App logs DATABASE_URL presence on every boot
- Migration status checked automatically
- Warnings logged if issues detected
- **Prevents:** Silent failures going unnoticed

### 2. **Environment Variable Consistency**
- Prisma and Next.js read from same sources
- `.env.local` takes priority (Next.js convention)
- **Prevents:** Prisma Studio showing "No tables found" due to wrong DB

### 3. **Premium Gate Fail-Safe**
- DB unavailable = "Unable to verify" (not "not premium")
- Structured error responses differentiate failure modes
- **Prevents:** Premium users treated as non-premium during DB outages

### 4. **Meta Review Mode Protection**
- `META_REVIEW_MODE=true` allows connection testing when DB unavailable
- Shows warning banner instead of blocking UI
- Publishing still gated by `META_PUBLISHING_ENABLED`
- **Prevents:** Meta App Review testing blocked by infrastructure issues

### 5. **Documentation**
- `DB_BOOTSTRAP_GUIDE.md` provides step-by-step procedures
- Common issues and fixes documented
- **Prevents:** Repeated troubleshooting of same issues

---

## Verification Checklist

After applying these changes:

1. **Prisma Studio loads tables:**
   ```powershell
   pnpm db:studio
   # Should show: User, SocialQueueItem, etc.
   ```

2. **Startup logs show database status:**
   ```
   [DB Startup] DATABASE_URL present: YES
   [DB Startup] ✓ Database connection successful
   [DB Startup] ✓ Database tables found
   ```

3. **App loads premium state correctly:**
   - Premium users: No "Upgrade to Premium" CTA
   - DB unavailable: Shows "Unable to verify subscription" (not upgrade CTA)

4. **Meta review mode works:**
   - Set `META_REVIEW_MODE=true` in `.env.local`
   - DB unavailable: Shows "Limited Review Mode" banner
   - Connection UI still accessible

---

## Environment Variables

### Required for Local Development

**`.env.local` (Next.js reads this):**
```
DATABASE_URL=postgresql://...
```

**`.env` (Prisma CLI reads this):**
```
DATABASE_URL=postgresql://...
```

**Note:** Both should have the same value. `.env.local` takes priority.

### Optional for Meta Review

**`.env.local`:**
```
META_REVIEW_MODE=true  # Allows connection testing when DB unavailable
META_PUBLISHING_ENABLED=false  # Gates publishing (for initial review)
```

---

## Quick Fixes

### If Prisma Studio shows "No tables found":

1. **Check DATABASE_URL in `.env`:**
   ```powershell
   Select-String -Path .env -Pattern "DATABASE_URL"
   ```

2. **If missing, copy from `.env.local`:**
   ```powershell
   $dbUrl = (Get-Content .env.local | Select-String "DATABASE_URL").Line
   Add-Content -Path .env -Value $dbUrl
   ```

3. **Apply migrations:**
   ```powershell
   pnpm db:deploy
   ```

4. **Restart Prisma Studio:**
   ```powershell
   pnpm db:studio
   ```

### If premium users see "Upgrade to Premium":

1. **Check startup logs for DB warnings**
2. **Verify DATABASE_URL is correct**
3. **Run migrations:** `pnpm db:deploy`
4. **If DB is temporarily unavailable:**
   - Set `META_REVIEW_MODE=true` for testing
   - Or wait for DB to recover (app handles gracefully)

---

## Summary

These changes ensure:
- ✅ Prisma and Next.js use the same `DATABASE_URL`
- ✅ Startup checks detect issues early
- ✅ Premium gate handles DB failures gracefully
- ✅ Meta App Review testing not blocked by infrastructure
- ✅ Comprehensive documentation prevents regressions

The app now has guardrails to prevent database connectivity issues from silently breaking functionality.

