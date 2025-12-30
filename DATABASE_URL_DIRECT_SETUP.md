# DATABASE_URL_DIRECT Setup Guide

## Why Two Database URLs?

This project uses **two separate database connection strings**:

1. **`DATABASE_URL`** - Used by Next.js runtime (application code)
   - May be `prisma+postgres://...` (Prisma Accelerate/Data Proxy) for optimized queries
   - Used for all runtime database operations via Prisma Client
   - Set in `.env.local` or Vercel environment variables

2. **`DATABASE_URL_DIRECT`** - Used by Prisma CLI tools only
   - **MUST be** a direct `postgresql://...` connection string
   - Required for: `prisma migrate`, `prisma studio`, `prisma db`, `prisma generate`
   - Set in `.env` file
   - **Prisma Studio does NOT support `prisma+postgres://` protocol**

### Why This Separation?

- Prisma Accelerate/Data Proxy (`prisma+postgres://`) optimizes runtime queries
- Prisma CLI tools (migrations, studio) require direct PostgreSQL connections
- This allows using Accelerate in production while maintaining CLI tool compatibility

---

## Quick Setup

### Add to `.env` file:

```bash
DATABASE_URL_DIRECT=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

Replace the placeholders:
- `USER` - Your PostgreSQL username (often `postgres`)
- `PASSWORD` - Your PostgreSQL password  
- `HOST` - Your PostgreSQL host (e.g., `localhost` or `your-db-host.railway.app`)
- `PORT` - Your PostgreSQL port (usually `5432`)
- `DATABASE` - Your database name

### Example:

```bash
DATABASE_URL_DIRECT=postgresql://postgres:mypassword@localhost:5432/mydb?sslmode=require
```

### For Railway Postgres:

If using Railway, you can get the direct connection string from:
1. Railway Dashboard → Your Postgres Service
2. Click "Connect" or "Variables" tab
3. Copy the `POSTGRES_URL` (direct connection string, starts with `postgresql://`)
4. Use it as `DATABASE_URL_DIRECT`

**Note:** If you only see `DATABASE_URL` with `prisma+postgres://`, you'll need to extract or construct the direct connection string from your database provider's settings.

---

## Important Notes

- **`DATABASE_URL_DIRECT`** is used by Prisma CLI (migrations, studio, generate)
- **`DATABASE_URL`** remains unchanged (used by Next.js runtime, may be `prisma+postgres://`)
- Prisma Studio does NOT support `prisma+postgres://` protocol
- Both URLs can point to the same database, just different connection methods
- Runtime database operations are completely isolated from CLI tool configuration

---

## Verification Checklist

After adding `DATABASE_URL_DIRECT` to `.env`:

1. **Verify environment variable is set:**
   ```bash
   cat .env | grep DATABASE_URL_DIRECT
   # Should show: DATABASE_URL_DIRECT=postgresql://...
   ```

2. **Check Prisma can connect:**
   ```bash
   pnpm db:status
   # Expected: Shows migration status (no connection errors)
   ```

3. **Launch Prisma Studio:**
   ```bash
   pnpm db:studio
   # Expected: Browser opens at http://localhost:5555 with tables visible
   # Verify: User, Account, Session, etc. tables are listed (not "No tables found")
   ```

4. **Verify runtime is unaffected:**
   - Start your dev server: `pnpm dev`
   - Check startup logs for: `[DB Startup] DATABASE_URL present: YES`
   - Check startup logs for: `[DB Startup] DATABASE_URL_DIRECT present: YES`
   - App should work normally (no "DB unavailable" warnings)

