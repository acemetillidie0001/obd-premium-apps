# Vercel Deployment Troubleshooting

## Quick Diagnosis

### 1. Check What's Actually Deployed

**Option A: Footer Build Stamp**
- Scroll to the bottom of any page on `apps.ocalabusinessdirectory.com`
- Look for a small build stamp showing:
  - Commit SHA (first 7 characters)
  - Environment (production/preview/development)
  - Build timestamp
- **Note:** Build stamp only shows if:
  - `OBD_SHOW_BUILD_STAMP=true` is set in Vercel environment variables, OR
  - Not in production environment

**Option B: Health Endpoint**
- Visit: `https://apps.ocalabusinessdirectory.com/api/health`
- Returns JSON with:
  ```json
  {
    "ok": true,
    "vercelEnv": "production",
    "commitSha": "0898429...",
    "buildTime": "2025-12-26T...",
    "nodeEnv": "production",
    "timestamp": "2025-12-26T..."
  }
  ```
- Compare `commitSha` with your latest GitHub commit

### 2. Verify Production Domain Assignment

1. Go to Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Find `apps.ocalabusinessdirectory.com`
3. Verify it's assigned to **Production** environment
4. Check which deployment it's pointing to (click the domain to see details)

### 3. Check Deployment Source Commit

1. Go to Vercel Dashboard → **Deployments** tab
2. Find the deployment marked as **"Current"** or **"Production"**
3. Click on the deployment to open details
4. In the **Source** section, verify:
   - **Branch:** Should be `main` (or your production branch)
   - **Commit:** Should match your latest GitHub commit SHA
5. If the commit SHA doesn't match:
   - The deployment is from an old commit
   - You need to deploy the latest commit

## Force a Correct Deployment

### Method 1: Clear Cache and Redeploy (Recommended)

1. Go to Vercel Dashboard → **Deployments** tab
2. Find the latest deployment (even if it's old)
3. Click the three dots (⋯) → **"Redeploy"**
4. In the modal:
   - ✅ Check **"Use existing Build Cache"** → **UNCHECK IT** (clear cache)
   - Git Reference: Enter your latest commit SHA (e.g., `0898429`)
   - Or select `main` branch
5. Click **"Redeploy"**
6. Wait for status: **"Building"** → **"Ready"**

### Method 2: Promote Deployment to Production

If you have a preview deployment with the correct commit:

1. Go to **Deployments** tab
2. Find the deployment with the correct commit SHA
3. Click the three dots (⋯) → **"Promote to Production"**
4. Confirm the promotion

### Method 3: Manual Deployment from Commit

1. Click **"New Deployment"** button (top right)
2. In the modal:
   - Git Repository: `acemetillidie0001/obd-premium-apps`
   - Git Reference: Enter commit SHA (e.g., `0898429` or `1ace562`)
   - Framework Preset: Next.js
3. Click **"Deploy"**
4. After deployment completes, verify it's assigned to Production

## If Auto-Deploy Stops Working

### Check 1: GitHub Integration

1. Go to Vercel Dashboard → **Settings** → **Git**
2. Verify:
   - Repository shows: `acemetillidie0001/obd-premium-apps`
   - Status: **"Connected"** (not "Disconnected")
3. If disconnected:
   - Click **"Disconnect"**
   - Click **"Connect GitHub"**
   - Select the repository
   - Authorize permissions

### Check 2: GitHub Webhooks

1. Go to: `https://github.com/acemetillidie0001/obd-premium-apps/settings/hooks`
2. Look for a Vercel webhook
3. If missing:
   - Reconnect GitHub in Vercel (Settings → Git → Disconnect → Connect)
   - Vercel will automatically create the webhook
4. If webhook exists but shows errors:
   - Check the "Recent Deliveries" tab
   - Look for failed deliveries
   - Reconnect GitHub integration if needed

### Check 3: Production Branch Setting

1. Go to Vercel Dashboard → **Settings** → **Git**
2. Verify **"Production Branch"** is set to `main`
3. If it's set to a different branch, change it to `main`

### Check 4: Commit Author Permissions

- For private repos, the commit author must have Vercel project access
- Verify your Git email matches your Vercel account email
- Ensure you're a member of the Vercel team/project

## Verification Checklist

After deploying, verify:

- [ ] Footer build stamp shows the correct commit SHA (if enabled)
- [ ] `/api/health` endpoint returns the correct `commitSha`
- [ ] Vercel deployment details show the correct commit SHA in **Source**
- [ ] Deployment status is **"Ready"** and marked as **"Production"**
- [ ] Domain `apps.ocalabusinessdirectory.com` is assigned to the deployment
- [ ] Test the site in incognito mode (bypasses browser cache)
- [ ] Footer Privacy/Terms links work correctly

## Common Issues

### Issue: Deployment shows old commit

**Solution:** 
- The deployment is from an old commit
- Use "Clear Cache and Redeploy" with the latest commit SHA
- Or create a new deployment from the latest commit

### Issue: Auto-deploy not triggering

**Solution:**
- Check GitHub webhooks (should exist and be active)
- Reconnect GitHub integration in Vercel
- Verify production branch is set correctly
- Check Vercel status page for outages

### Issue: Changes not visible after deployment

**Solution:**
- Hard refresh browser (Ctrl+Shift+R)
- Test in incognito mode
- Check CDN cache (Vercel may cache static assets)
- Verify the deployment actually includes your changes (check Source commit)

### Issue: Build stamp not showing

**Solution:**
- Set `OBD_SHOW_BUILD_STAMP=true` in Vercel environment variables
- Or it will auto-show in non-production environments
- Check that the footer component is rendering correctly

## Quick Reference

- **Health Endpoint:** `https://apps.ocalabusinessdirectory.com/api/health`
- **GitHub Repo:** `https://github.com/acemetillidie0001/obd-premium-apps`
- **Vercel Dashboard:** `https://vercel.com/ocala-business-directorys-projects/obd-premium-apps`
- **GitHub Webhooks:** `https://github.com/acemetillidie0001/obd-premium-apps/settings/hooks`

