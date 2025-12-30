# Database Configuration Verification Checklist

## 60-Second Verification

Use this checklist to verify the dual-URL database setup is working correctly.

### Prerequisites
- `DATABASE_URL_DIRECT` must be in `.env` file at repo root
- `DATABASE_URL` must be in `.env.local` or Vercel environment variables

---

## Step-by-Step Verification

### ✅ Step 1: Verify Environment Variables

```bash
# Check DATABASE_URL_DIRECT is in .env (for Prisma CLI)
cat .env | grep DATABASE_URL_DIRECT
# Expected: DATABASE_URL_DIRECT=postgresql://...

# Check DATABASE_URL is in .env.local (for runtime)
cat .env.local | grep DATABASE_URL
# Expected: DATABASE_URL=prisma+postgres://... or postgresql://...
```

**Pass Criteria:** Both commands show their respective environment variables.

---

### ✅ Step 2: Verify Prisma CLI Can Connect

```bash
# Check migration status (uses DATABASE_URL_DIRECT)
pnpm db:status
```

**Pass Criteria:** 
- No connection errors
- Shows migration status (e.g., "Database schema is up to date!" or lists pending migrations)
- Does NOT show: "The prisma+postgres protocol with localhost is not supported"

---

### ✅ Step 3: Verify Prisma Studio Launches

```bash
# Launch Prisma Studio (uses DATABASE_URL_DIRECT)
pnpm db:studio
```

**Pass Criteria:**
- Browser opens at `http://localhost:5555`
- **Tables are visible** (User, Account, Session, etc.)
- Does NOT show: "No tables found"
- Does NOT show protocol errors about `prisma+postgres://`

**Common Failure:** If you see "No tables found", check:
- Is `DATABASE_URL_DIRECT` correctly formatted? (must be `postgresql://`, not `prisma+postgres://`)
- Are migrations applied? Run `pnpm db:deploy`

---

### ✅ Step 4: Verify Runtime Database Connection

```bash
# Start development server
pnpm dev
```

**Check startup logs for:**
```
[DB Startup] DATABASE_URL present: YES
[DB Startup] DATABASE_URL_DIRECT present: YES
[DB Startup] ✓ Database connection successful
[DB Startup] ✓ Database tables found (migrations appear applied)
```

**Pass Criteria:**
- Both URLs show as present
- No connection errors
- Tables found message appears

---

### ✅ Step 5: Verify Premium Gate Does Not Regress

1. Login to the app as a premium user
2. Navigate to Social Auto-Poster setup page
3. Verify you do NOT see "Upgrade to Premium" CTA
4. Verify the page loads normally

**Pass Criteria:**
- Premium users see normal functionality
- No false "Upgrade to Premium" messages
- No "Subscription Status Unavailable" warnings (unless DB is actually down)

---

### ✅ Step 6: Verify Data Deletion Page Loads

1. Navigate to `/data-deletion` page
2. Verify page loads without errors
3. Check browser console for any 500 errors

**Pass Criteria:**
- Page loads successfully
- No database errors in console
- Page content is visible

---

## Troubleshooting

### If Step 2 or 3 Fails

**Error: "DATABASE_URL_DIRECT is not set"**
- Add `DATABASE_URL_DIRECT` to `.env` file
- Format: `DATABASE_URL_DIRECT=postgresql://user:password@host:port/database?sslmode=require`

**Error: "The prisma+postgres protocol is not supported"**
- Ensure `DATABASE_URL_DIRECT` uses `postgresql://` (not `prisma+postgres://`)
- Check your `.env` file has the correct format

**Error: "No tables found" in Prisma Studio**
- Run migrations: `pnpm db:deploy`
- Verify `DATABASE_URL_DIRECT` points to the correct database
- Check that migrations were applied successfully

### If Step 4 Fails

**Error: "DATABASE_URL present: NO"**
- Add `DATABASE_URL` to `.env.local` or Vercel environment variables
- Runtime needs `DATABASE_URL` (may be `prisma+postgres://` or `postgresql://`)

**Error: Connection failures**
- Verify both URLs point to the same database (or compatible endpoints)
- Check database server is accessible
- Verify credentials are correct

### If Step 5 Fails

**Premium users see "Upgrade to Premium"**
- Check app logs for database connection errors
- Verify `DATABASE_URL` is set correctly for runtime
- Check that premium gate fail-safe logic is working (returns 503, not 403, on DB errors)

---

## Success Criteria Summary

All steps should pass:
- ✅ Both environment variables are set
- ✅ Prisma CLI connects successfully
- ✅ Prisma Studio shows tables
- ✅ Runtime connects successfully
- ✅ Premium gate works correctly
- ✅ Data deletion page loads

---

## Next Steps

Once all checks pass:
- Prisma Studio is stable and isolated from runtime DB configuration
- Runtime can use `prisma+postgres://` (Accelerate) without affecting CLI tools
- No further "DB disappeared" confusion should occur
- All database operations are properly configured

