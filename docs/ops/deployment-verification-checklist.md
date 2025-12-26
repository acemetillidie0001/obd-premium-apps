# Production Deployment Verification Checklist

## Pre-Deployment Verification

### ✅ A. Configuration Checks

1. **package.json verification:**
   - [x] `"packageManager": "pnpm@10.26.1"` is present
   - [x] `engines.node >= 20.0.0` is specified
   - [x] `engines.pnpm >= 10.0.0` is specified
   - [x] `pnpm` is NOT in `dependencies` (only in `engines`)

2. **vercel.json verification:**
   - [x] No `buildCommand` field (Vercel auto-detects pnpm from `packageManager`)

3. **prisma.config.ts verification:**
   - [x] Fails fast in production if `DATABASE_URL` is missing
   - [x] Fallback only allowed in non-production environments

---

## Deployment Commands

### Step 1: Build Locally (Verify)
```powershell
pnpm build
```
**Expected:** Build completes successfully with no errors

### Step 2: Commit Changes
```powershell
git add .
git commit -m "fix: resolve Vercel build failures - add packageManager, fix TypeScript errors, harden Prisma config"
```

### Step 3: Push to GitHub
```powershell
git push origin main
```

### Step 4: Deploy to Production
```powershell
vercel --prod --force
```

**Expected Output:**
- Deployment URL: `https://obd-premium-apps-xxxxx.vercel.app`
- Production URL: `https://apps.ocalabusinessdirectory.com`
- Status: "Ready"

---

## Post-Deployment Verification

### ✅ 1. Vercel Dashboard Verification

**Go to:** https://vercel.com/ocala-business-directorys-projects/obd-premium-apps/deployments

1. **Find Latest Production Deployment:**
   - [ ] Status is "Ready" (not "Building" or "Error")
   - [ ] Environment shows "Production"
   - [ ] Deployment is marked as "Current" or "Production"

2. **Check Deployment Source:**
   - Click on the deployment to open details
   - In **"Source"** section, verify:
     - [ ] Branch: `main`
     - [ ] Commit: Matches your latest GitHub commit SHA (e.g., `abc1234...`)
   - In **"Domains"** section, verify:
     - [ ] `apps.ocalabusinessdirectory.com` is listed
     - [ ] Points to this deployment

3. **Check Build Logs:**
   - Click **"View Build Logs"** or **"View Function Logs"**
   - Verify:
     - [ ] Shows `pnpm install` (NOT `npm install`)
     - [ ] Shows `pnpm build` completing successfully
     - [ ] No errors about missing `DATABASE_URL` during Prisma generate
     - [ ] No TypeScript compilation errors
     - [ ] Build completes with "Ready" status

---

### ✅ 2. Health Endpoint Verification

**Visit:** https://apps.ocalabusinessdirectory.com/api/health

**Expected Response:**
```json
{
  "ok": true,
  "vercelEnv": "production",
  "commitSha": "abc1234...",
  "buildTime": "2025-12-26T...",
  "nodeEnv": "production",
  "timestamp": "2025-12-26T..."
}
```

**Verification:**
- [ ] Returns HTTP 200 (not 404)
- [ ] `ok` is `true`
- [ ] `vercelEnv` is `"production"`
- [ ] `commitSha` matches your latest GitHub commit SHA
- [ ] `nodeEnv` is `"production"`

**If 404:**
- Deployment didn't include the `/api/health` route
- Check deployment commit SHA matches GitHub
- Verify `src/app/api/health/route.ts` exists in the deployed commit

---

### ✅ 3. Production Site Verification

**Visit:** https://apps.ocalabusinessdirectory.com

1. **Footer Links:**
   - [ ] Scroll to footer
   - [ ] Click **"Privacy"** → Should open: https://ocalabusinessdirectory.com/obd-business-suite-privacy-policy/
   - [ ] Click **"Terms"** → Should open: https://ocalabusinessdirectory.com/obd-business-suite-terms-of-service/
   - [ ] Both links open in new tabs (`target="_blank"`)
   - [ ] Both links have `rel="noopener noreferrer"` (check in browser dev tools)

2. **Build Stamp (if enabled):**
   - [ ] Scroll to footer
   - [ ] If `OBD_SHOW_BUILD_STAMP=true` is set in Vercel Production environment variables:
     - [ ] Build stamp shows: `Build: <7-char-sha> | production | <timestamp>`
     - [ ] Commit SHA matches your latest GitHub commit SHA
   - [ ] If `OBD_SHOW_BUILD_STAMP` is NOT set:
     - [ ] Build stamp does NOT show (expected behavior)

3. **Hard Refresh:**
   - [ ] Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
   - [ ] Or test in incognito/private window
   - [ ] Changes should be visible

---

### ✅ 4. Dashboard Verification

**Visit:** https://apps.ocalabusinessdirectory.com

1. **Social Auto Poster Tile:**
   - [ ] Dashboard shows "Social Auto Poster" tile
   - [ ] Status shows "Live" (NOT "Coming Q1 2026")
   - [ ] Clicking the tile navigates to `/apps/social-auto-poster`

---

## Troubleshooting

### Issue: Build fails with "DATABASE_URL is required in production"

**Cause:** `DATABASE_URL` environment variable is not set in Vercel Production environment.

**Solution:**
1. Go to: https://vercel.com/ocala-business-directorys-projects/obd-premium-apps/settings/environment-variables
2. Verify `DATABASE_URL` is set for **Production** environment
3. If missing, add it:
   - Name: `DATABASE_URL`
   - Value: Your production database connection string
   - Environment: Production
4. Redeploy

### Issue: Health endpoint returns 404

**Possible Causes:**
1. Deployment doesn't include the route (check commit SHA)
2. Route file doesn't exist in codebase
3. Build failed and old code is still running

**Diagnosis:**
1. Check Vercel deployment logs for build errors
2. Verify `src/app/api/health/route.ts` exists in your codebase
3. Compare deployment commit SHA with GitHub
4. Check `/api/health` route exists in Vercel Functions tab

### Issue: Footer links don't work

**Possible Causes:**
1. Deployment doesn't include layout changes
2. Browser cache (try incognito)

**Solution:**
1. Hard refresh: `Ctrl + Shift + R`
2. Test in incognito window
3. Verify deployment commit SHA includes `src/app/layout.tsx` changes

### Issue: Build stamp doesn't show

**Possible Causes:**
1. `OBD_SHOW_BUILD_STAMP` not set in Production environment
2. Build stamp logic disabled in production

**Solution:**
1. Go to: https://vercel.com/ocala-business-directorys-projects/obd-premium-apps/settings/environment-variables
2. Add variable:
   - Name: `OBD_SHOW_BUILD_STAMP`
   - Value: `true`
   - Environment: Production
3. Redeploy

### Issue: Vercel still uses npm instead of pnpm

**Possible Causes:**
1. `packageManager` field missing from `package.json`
2. Old deployment cache

**Solution:**
1. Verify `package.json` has `"packageManager": "pnpm@10.26.1"`
2. Redeploy with `--force` flag: `vercel --prod --force`
3. Check build logs show `pnpm install` (not `npm install`)

---

## Quick Reference

- **Vercel Dashboard:** https://vercel.com/ocala-business-directorys-projects/obd-premium-apps
- **Production Site:** https://apps.ocalabusinessdirectory.com
- **Health Endpoint:** https://apps.ocalabusinessdirectory.com/api/health
- **GitHub Repo:** https://github.com/acemetillidie0001/obd-premium-apps
- **Vercel Environment Variables:** https://vercel.com/ocala-business-directorys-projects/obd-premium-apps/settings/environment-variables

---

## Summary

After completing all verification steps:
- [ ] All checks pass
- [ ] Production site shows latest changes
- [ ] Health endpoint returns correct commit SHA
- [ ] Footer links work correctly
- [ ] Build stamp shows (if enabled)
- [ ] Dashboard shows Social Auto Poster as live

**If any check fails, refer to the Troubleshooting section above.**

