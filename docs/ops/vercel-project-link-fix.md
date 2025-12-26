# Vercel Project Link Fix - Complete Guide

## Problem Summary
- Local repo was linked to wrong Vercel project: `cursor-app-build`
- Should be linked to: `obd-premium-apps` (production: apps.ocalabusinessdirectory.com)
- GitHub auto-deploy stopped working
- Manual redeploys were using old commits

## ✅ Step 2: Delete Local Vercel Link (COMPLETED)

**PowerShell Commands:**
```powershell
# Verify .vercel folder exists
if (Test-Path .vercel) { Write-Host "EXISTS" } else { Write-Host "NOT FOUND" }

# Remove .vercel folder
Remove-Item -Recurse -Force .vercel -ErrorAction SilentlyContinue

# Confirm removal
if (Test-Path .vercel) { Write-Host "ERROR: Still exists" } else { Write-Host "SUCCESS: Removed" }
```

**Status:** ✅ `.vercel` folder removed

---

## ✅ Step 3: Verify Git Repo (COMPLETED)

**PowerShell Commands:**
```powershell
# Check remote repository
git remote -v

# Check current branch
git branch --show-current

# Check latest commit
git log -1 --oneline
```

**Expected Output:**
- Remote: `origin https://github.com/acemetillidie0001/obd-premium-apps.git`
- Branch: `main`
- Latest commit: `0342fef` (or your latest commit SHA)

**Status:** ✅ Git repo verified

---

## ✅ Step 4: Fix Vercel CLI Project Link (COMPLETED)

**PowerShell Commands:**

```powershell
# 1. Verify you're logged in
vercel whoami

# 2. List teams (find your team ID)
vercel teams ls

# 3. List projects in your team
vercel projects ls --scope ocala-business-directorys-projects

# 4. Link to correct project (NON-INTERACTIVE)
vercel link --yes --scope ocala-business-directorys-projects --project obd-premium-apps

# 5. Verify the link
Get-Content .vercel\project.json
```

**Expected Output from Step 5:**
```json
{
  "projectId": "prj_3eTFVq1MjtyauGybA075t3RNQR38",
  "orgId": "team_xevDaN6csRXjD4GUudmEaQ8n",
  "projectName": "obd-premium-apps"
}
```

**Important:** Verify `projectName` is `obd-premium-apps` (NOT `cursor-app-build`)

**Status:** ✅ Linked to `obd-premium-apps`

---

## ⚠️ Step 5: Deploy to Production

### Option A: Vercel CLI (Recommended)

**PowerShell Command:**
```powershell
vercel --prod --force
```

**Note:** If you get a cron job error about Hobby plan limits:
- The cron schedule `* * * * *` (every minute) exceeds Hobby plan
- Change `vercel.json` cron to daily: `"0 3 * * *"` (3 AM daily)
- Then retry deployment

**Expected Output:**
- Deployment URL: `https://obd-premium-apps-xxxxx.vercel.app`
- Production URL: `https://apps.ocalabusinessdirectory.com`
- Status: "Ready"

### Option B: Vercel Dashboard (If CLI fails)

1. Go to: https://vercel.com/ocala-business-directorys-projects/obd-premium-apps
2. Click **"Deployments"** tab
3. Click **"New Deployment"** button (top right)
4. In the modal:
   - **Git Repository:** `acemetillidie0001/obd-premium-apps`
   - **Git Reference:** Enter your latest commit SHA (e.g., `0342fef`) OR select `main` branch
   - **Framework Preset:** Next.js (should auto-detect)
5. Click **"Deploy"**
6. Wait for status: **"Building"** → **"Ready"**
7. Verify the deployment is marked as **"Production"**

---

## Step 6: Restore GitHub Auto-Deploy

### Verify Git Integration

1. Go to: https://vercel.com/ocala-business-directorys-projects/obd-premium-apps/settings/git
2. Verify:
   - **Repository:** `acemetillidie0001/obd-premium-apps`
   - **Status:** "Connected" (not "Disconnected")
   - **Production Branch:** `main`

### Check GitHub Webhooks

1. Go to: https://github.com/acemetillidie0001/obd-premium-apps/settings/hooks
2. Look for a Vercel webhook
3. If missing or showing errors:
   - Go back to Vercel → Settings → Git
   - Click **"Disconnect"**
   - Click **"Connect GitHub"**
   - Select repository: `acemetillidie0001/obd-premium-apps`
   - Authorize permissions
   - Vercel will automatically create the webhook

### Test Auto-Deploy

1. Make a small change (e.g., add a comment to a file)
2. Commit and push:
   ```powershell
   git add .
   git commit -m "test: verify auto-deploy"
   git push origin main
   ```
3. Within 1-2 minutes, check Vercel Dashboard → Deployments
4. You should see a new deployment automatically created

---

## Step 7: Verification Checklist

### ✅ A. Vercel Dashboard Verification

1. Go to: https://vercel.com/ocala-business-directorys-projects/obd-premium-apps/deployments
2. Find the latest deployment marked as **"Production"**
3. Click on the deployment to open details
4. In **"Source"** section, verify:
   - **Branch:** `main`
   - **Commit:** `0342fef` (or your latest commit SHA)
5. In **"Domains"** section, verify:
   - `apps.ocalabusinessdirectory.com` is listed
   - Points to this deployment

### ✅ B. Production Site Verification

1. **Health Endpoint:**
   - Visit: https://apps.ocalabusinessdirectory.com/api/health
   - **Expected:** JSON response with `ok: true`, `commitSha`, `vercelEnv: "production"`
   - **If 404:** Production is not updated OR route doesn't exist in code
   - **If 200:** Compare `commitSha` with your latest GitHub commit

2. **Footer Build Stamp:**
   - Visit: https://apps.ocalabusinessdirectory.com
   - Scroll to footer
   - **If enabled:** Should show commit SHA, environment, build time
   - **To enable:** Set `OBD_SHOW_BUILD_STAMP=true` in Vercel environment variables

3. **Footer Links:**
   - Click **"Privacy"** → Should open: https://ocalabusinessdirectory.com/obd-business-suite-privacy-policy/
   - Click **"Terms"** → Should open: https://ocalabusinessdirectory.com/obd-business-suite-terms-of-service/
   - Both should open in new tabs

4. **Hard Refresh:**
   - Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
   - Or test in incognito/private window

### ✅ C. Git Integration Verification

1. Go to: https://vercel.com/ocala-business-directorys-projects/obd-premium-apps/settings/git
2. Verify:
   - Repository: `acemetillidie0001/obd-premium-apps`
   - Status: **"Connected"**
   - Production Branch: `main`
3. Check GitHub webhooks: https://github.com/acemetillidie0001/obd-premium-apps/settings/hooks
4. Verify Vercel webhook exists and shows recent deliveries

---

## Troubleshooting

### Issue: Deployment fails with "Hobby plan cron limit"

**Solution:**
1. Edit `vercel.json`
2. Change cron schedule from `* * * * *` to `0 3 * * *` (daily at 3 AM)
3. Commit and redeploy

### Issue: `/api/health` returns 404

**Possible Causes:**
1. Production deployment doesn't include the route (check commit SHA)
2. Route file doesn't exist in codebase
3. Build failed and old code is still running

**Diagnosis:**
1. Check Vercel deployment logs for build errors
2. Verify `src/app/api/health/route.ts` exists in your codebase
3. Compare deployment commit SHA with GitHub

### Issue: Auto-deploy still not working after reconnecting

**Solution:**
1. Disconnect Git integration in Vercel
2. Go to GitHub → Settings → Applications → Authorized OAuth Apps
3. Revoke Vercel access
4. Reconnect in Vercel (this will re-authorize)
5. Test with a new commit

### Issue: CLI still links to wrong project

**Solution:**
1. Remove `.vercel` folder: `Remove-Item -Recurse -Force .vercel`
2. Use explicit flags: `vercel link --yes --scope <team-id> --project obd-premium-apps`
3. Verify: `Get-Content .vercel\project.json` shows `obd-premium-apps`

---

## Quick Reference

- **Vercel Dashboard:** https://vercel.com/ocala-business-directorys-projects/obd-premium-apps
- **GitHub Repo:** https://github.com/acemetillidie0001/obd-premium-apps
- **Production Site:** https://apps.ocalabusinessdirectory.com
- **Health Endpoint:** https://apps.ocalabusinessdirectory.com/api/health
- **GitHub Webhooks:** https://github.com/acemetillidie0001/obd-premium-apps/settings/hooks

---

## Summary of Changes Made

1. ✅ Removed `.vercel` folder (cleared wrong project cache)
2. ✅ Verified Git repo is correct (`acemetillidie0001/obd-premium-apps`)
3. ✅ Linked Vercel CLI to correct project (`obd-premium-apps`)
4. ⚠️ Fixed cron schedule in `vercel.json` (changed to daily to comply with Hobby plan)
5. ⏳ Deployment initiated (may need to retry if build fails)

**Next Steps:**
- Complete deployment via CLI or Vercel Dashboard
- Verify production site shows latest changes
- Test GitHub auto-deploy with a test commit

