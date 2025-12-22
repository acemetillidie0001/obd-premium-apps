# Deployment Troubleshooting Guide

## 🔍 Diagnosing Failed Deployments

If your Vercel deployments are failing, follow these steps:

---

## Step 1: Check Deployment Logs

1. Go to your failed deployment in Vercel
2. Click on the deployment to view details
3. Click **"View Function Logs"** or **"Build Logs"**
4. Look for error messages

### Common Error Messages:

#### ❌ "Missing required environment variables"
**Cause:** Environment variables not set in Vercel

**Solution:**
1. Go to **Project → Settings → Environment Variables**
2. Add all required variables (see `docs/VERCEL_ENV_SETUP.md`)
3. **Redeploy** the application

#### ❌ "Can't reach database server"
**Cause:** `DATABASE_URL` is incorrect or database is not accessible

**Solution:**
1. Verify `DATABASE_URL` is set correctly
2. Check database is running and accessible
3. Ensure database allows connections from Vercel IPs

#### ❌ "Prisma Client not generated"
**Cause:** Prisma Client needs to be generated

**Solution:**
- This should happen automatically via `postinstall` script
- If it fails, check build logs for Prisma errors

#### ❌ "Module not found" or "Cannot find module"
**Cause:** Dependencies not installed or build issue

**Solution:**
1. Check `package.json` has all dependencies
2. Verify `node_modules` is in `.gitignore` (it should be)
3. Vercel should install dependencies automatically

---

## Step 2: Verify Environment Variables

### Quick Checklist:

- [ ] `NEXTAUTH_SECRET` is set (min 32 characters)
- [ ] `NEXTAUTH_URL` is set to `https://apps.ocalabusinessdirectory.com`
- [ ] `RESEND_API_KEY` is set (starts with `re_`)
- [ ] `EMAIL_FROM` is set (valid email address)
- [ ] `DATABASE_URL` is set (valid PostgreSQL connection string)
- [ ] All variables are enabled for **Production** environment

### How to Check:

1. Go to **Project → Settings → Environment Variables**
2. Verify each variable is listed
3. Check the environment dropdown (Production/Preview/Development)
4. Ensure variables are enabled for the correct environment

---

## Step 3: Run Database Migration

If the database schema is missing fields, you need to run migrations:

### Option A: Via Vercel Build Command

Add to **Project → Settings → Build & Development Settings**:

**Build Command:**
```bash
npm run migrate:deploy && npm run build
```

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login
vercel login

# Link project (if not already linked)
vercel link

# Run migration
vercel env pull .env.local
npm run migrate:deploy

# Deploy
vercel --prod
```

### Option C: Manual Migration

If you have direct database access:

```bash
# Set DATABASE_URL in your local environment
export DATABASE_URL="your-database-url"

# Run migration
npx prisma migrate deploy
```

---

## Step 4: Test Build Locally

Before deploying, test the build locally:

```bash
# Set environment variables in .env.local
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
RESEND_API_KEY=re_your-key
EMAIL_FROM=noreply@ocalabusinessdirectory.com
DATABASE_URL=your-database-url

# Test build
npm run build
```

If the build fails locally, fix the issue before deploying.

---

## Step 5: Check Specific Error Types

### Build-Time Errors

**Error:** TypeScript compilation errors
**Solution:** Fix TypeScript errors locally, then commit and push

**Error:** Missing dependencies
**Solution:** Run `npm install` and commit `package-lock.json`

### Runtime Errors

**Error:** Environment variable validation fails
**Solution:** Set all required env vars in Vercel and redeploy

**Error:** Database connection fails
**Solution:** 
- Verify `DATABASE_URL` is correct
- Check database firewall allows Vercel IPs
- Ensure database is running

**Error:** Prisma Client errors
**Solution:**
- Run `npx prisma generate` locally
- Ensure `postinstall` script runs: `"postinstall": "prisma generate"`

---

## Step 6: Redeploy After Fixes

After making changes:

1. **If you changed environment variables:**
   - Go to **Deployments** tab
   - Click **⋯** (three dots) on latest deployment
   - Click **Redeploy**
   - Or push a new commit

2. **If you changed code:**
   - Commit and push to trigger automatic deployment
   - Or manually redeploy from Vercel dashboard

**Important:** Environment variables are only available after redeployment!

---

## Common Issues & Solutions

### Issue: "Build succeeded but app crashes on first request"

**Cause:** Runtime environment variable validation failing

**Solution:**
1. Check deployment logs (not build logs)
2. Look for "Missing required environment variables" error
3. Set missing variables in Vercel
4. Redeploy

### Issue: "Database migration fails"

**Cause:** Migration already applied or database connection issue

**Solution:**
1. Check if migration was already applied:
   ```bash
   npx prisma migrate status
   ```
2. If migration is pending, run:
   ```bash
   npm run migrate:deploy
   ```
3. If connection fails, verify `DATABASE_URL`

### Issue: "Prisma Client not found"

**Cause:** `postinstall` script didn't run or failed

**Solution:**
1. Check build logs for Prisma errors
2. Verify `package.json` has: `"postinstall": "prisma generate"`
3. Ensure Prisma is in `devDependencies` or `dependencies`

### Issue: "All deployments failing"

**Cause:** Usually environment variables or database connection

**Solution:**
1. Check the **oldest** failed deployment logs (might have clearer errors)
2. Verify all environment variables are set
3. Test database connection
4. Check if there were recent code changes that broke something

---

## Quick Diagnostic Commands

### Check Environment Variables (Local)
```bash
# Check if .env.local exists
ls -la .env.local

# View env vars (be careful not to commit this!)
cat .env.local
```

### Test Database Connection
```bash
# Set DATABASE_URL
export DATABASE_URL="your-database-url"

# Test connection
npx prisma db pull
```

### Verify Prisma Schema
```bash
# Check schema
cat prisma/schema.prisma | grep -A 5 "model User"

# Should show:
# role          String    @default("user")
# isPremium     Boolean   @default(false)
```

### Test Build Locally
```bash
# Full build test
npm run build

# Should complete without errors
```

---

## Getting Help

If you're still stuck:

1. **Check Vercel Logs:**
   - Go to deployment → View Logs
   - Copy the full error message

2. **Check Local Build:**
   - Run `npm run build` locally
   - See if same error occurs

3. **Verify Environment:**
   - Run `npm run verify:db` (if DATABASE_URL is set)
   - Check all env vars are set

4. **Review Recent Changes:**
   - Check git history for recent commits
   - See if any changes might have broken deployment

---

## Prevention Checklist

Before deploying:

- [ ] All environment variables are set in Vercel
- [ ] Local build succeeds (`npm run build`)
- [ ] TypeScript compiles without errors
- [ ] Database migration has been run
- [ ] Prisma Client is generated
- [ ] No console errors in local development

---

**Last Updated:** December 2024

