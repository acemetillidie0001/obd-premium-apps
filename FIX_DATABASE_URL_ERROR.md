# Fix P1013 DATABASE_URL Error - Quick Guide

## The Problem
```
Error: P1013: The provided database string is invalid. The scheme is not recognized in database URL.
```

## Most Common Causes

### 1. **DATABASE_URL has a prefix** (MOST COMMON)
**Symptom:** The value in Vercel includes `DATABASE_URL=` at the start

**Fix:**
- Go to Vercel → Settings → Environment Variables
- Edit `DATABASE_URL`
- **Remove** any `DATABASE_URL=` prefix
- The value should START with `postgresql://` or `postgres://`
- Save and redeploy

**Example:**
```
❌ WRONG: DATABASE_URL=postgresql://user:pass@host/db
✅ CORRECT: postgresql://user:pass@host/db
```

### 2. **Placeholder text in the value**
**Symptom:** Value contains `<` or `>` characters

**Fix:**
- Replace any placeholder text with the actual connection string
- Remove any text like `<RAILWAY_PRISMA_URL>` or similar

### 3. **Special characters not URL-encoded**
**Symptom:** Password contains `@`, `:`, `/`, `?`, `#`, `[`, `]`

**Fix:**
- URL-encode special characters in the password:
  - `@` → `%40`
  - `:` → `%3A`
  - `/` → `%2F`
  - `?` → `%3F`
  - `&` → `%26`
  - `#` → `%23`
  - `[` → `%5B`
  - `]` → `%5D`

**Example:**
```
❌ WRONG: postgresql://user:p@ssw:rd@host/db
✅ CORRECT: postgresql://user:p%40ssw%3Ard@host/db
```

### 4. **Whitespace**
**Symptom:** Leading or trailing spaces

**Fix:**
- Remove any spaces before or after the connection string
- The value should be one continuous string with no spaces

## How to Verify

The validation script will now run automatically during `migrate:deploy` and show you exactly what's wrong.

## Quick Test

1. Check Vercel build logs - the validation script will show the issue
2. Or run locally (if you have DATABASE_URL set):
   ```bash
   npm run migrate:deploy
   ```

## Correct Format

Your `DATABASE_URL` should look like this:
```
postgresql://username:password@hostname:port/database?sslmode=require&connection_limit=1
```

**From Railway:**
- Get the connection string from Railway Postgres → Connect → Connection String
- It should already be in the correct format
- Just paste it directly into Vercel (no prefix, no modifications)

## Still Not Working?

If the validation passes but Prisma still fails:
1. Check Railway Postgres is running
2. Verify the database allows connections from Vercel IPs
3. Check SSL certificate settings
4. Verify the database name, username, and password are correct

