# Brand Kit Builder V3 — Rollback Plan

**Purpose:** Step-by-step guide to revert Brand Kit Builder V3 deployment if critical issues are discovered.

**When to Rollback:**
- Critical bugs affecting core functionality
- Database corruption or data loss
- Performance degradation
- Security vulnerabilities
- OpenAI API cost overruns

**Estimated Rollback Time:** 5-15 minutes

---

## Pre-Rollback Checklist

- [ ] Confirm issue severity (critical vs. minor)
- [ ] Check if hotfix is possible (preferred over rollback)
- [ ] Document the issue with requestIds/logs
- [ ] Notify team of rollback plan
- [ ] Backup current production state (if time permits)

---

## Rollback Options

### Option 1: Vercel Deployment Rollback (Recommended - Fastest)

**Best for:** Code-level issues, API bugs, UI regressions

**Time Estimate:** 2-5 minutes

**Steps:**

1. **Access Vercel Dashboard:**
   - Go to: https://vercel.com/dashboard
   - Select your project
   - Navigate to "Deployments" tab

2. **Find Previous Deployment:**
   - Locate the last successful deployment (before Brand Kit Builder V3)
   - Verify it's working (check commit hash/deploy message)
   - Note the deployment timestamp

3. **Revert to Previous Deployment:**
   - Click the "..." menu on the previous deployment
   - Select "Promote to Production"
   - Confirm the rollback

4. **Verify Rollback:**
   - Check `/apps/brand-kit-builder` route returns 404 or redirects
   - Verify other apps still work
   - Check Vercel logs for errors

5. **Update DNS/Custom Domain (if needed):**
   - If using custom domain, verify it points to correct deployment
   - Usually automatic, but check if issues persist

**What Gets Rolled Back:**
- ✅ All code changes (routes, components, types)
- ✅ API endpoints revert to previous state
- ✅ Frontend UI reverts to previous state
- ❌ Database schema changes remain (see Option 2)
- ❌ Environment variables remain (unchanged)

---

### Option 2: Database Schema Rollback (If Needed)

**Best for:** Database migration issues, schema conflicts

**⚠️ IMPORTANT:** BrandProfile migration is **additive only** (no data loss risk). This step is usually **NOT necessary** and should be skipped. Only rollback if:
- Migration caused database errors
- Schema conflicts with other features
- Explicit decision to remove BrandProfile feature

**Time Estimate:** 5-10 minutes

**Steps:**

1. **Create Rollback Migration:**
   ```bash
   # Create a new migration file to drop BrandProfile table
   npx prisma migrate dev --create-only --name rollback_brand_profile
   ```

2. **Edit Migration File:**
   ```sql
   -- Remove BrandProfile table
   DROP TABLE IF EXISTS "BrandProfile";
   ```

3. **Test Migration Locally:**
   ```bash
   pnpm prisma migrate dev
   ```

4. **Deploy Migration to Production:**
   ```bash
   # Connect to production database
   pnpm prisma migrate deploy
   ```

5. **Verify:**
   - Check Prisma Studio or database console
   - Confirm BrandProfile table is removed
   - Verify no foreign key constraints are broken

**⚠️ Data Loss Warning:** This permanently deletes all saved brand profiles. Only proceed if absolutely necessary.

**What Gets Rolled Back:**
- ✅ BrandProfile table removed
- ✅ User.brandProfile relation removed
- ❌ Data in BrandProfile is lost (backup first if needed)

---

### Option 3: Feature Flag / Environment-Based Disable (Partial Rollback)

**Best for:** Gradual rollout, A/B testing, temporary disable

**Time Estimate:** 10-15 minutes (requires code change + deploy)

**Steps:**

1. **Add Environment Variable:**
   - In Vercel Dashboard → Settings → Environment Variables
   - Add: `DISABLE_BRAND_KIT_BUILDER=true`
   - Scope: Production only

2. **Update Middleware or Route Handler:**
   ```typescript
   // In middleware.ts or route handler
   if (process.env.DISABLE_BRAND_KIT_BUILDER === "true") {
     return NextResponse.redirect(new URL("/apps", req.url));
   }
   ```

3. **Redeploy:**
   - Trigger new deployment (or wait for auto-deploy)
   - Verify feature is disabled

**What Gets Rolled Back:**
- ✅ Feature is disabled (users can't access)
- ✅ Routes return 404 or redirect
- ✅ Database remains intact
- ✅ Code remains in codebase (can re-enable quickly)

---

## Post-Rollback Steps

### 1. Verify System Stability

- [ ] Check all premium apps load correctly
- [ ] Test authentication flow
- [ ] Verify database connections
- [ ] Check Vercel logs for errors
- [ ] Test critical user flows

### 2. Communicate with Users

- [ ] Update status page (if applicable)
- [ ] Send notification (if critical issue)
- [ ] Document outage in internal logs

### 3. Investigate Root Cause

- [ ] Review error logs with requestIds
- [ ] Check deployment logs
- [ ] Analyze database queries (if applicable)
- [ ] Review code changes in rolled-back commit
- [ ] Document findings for future prevention

### 4. Plan Fix and Re-Deployment

- [ ] Fix the identified issue
- [ ] Test fix in local environment
- [ ] Run automated tests
- [ ] Plan re-deployment strategy (staged rollout recommended)
- [ ] Update rollback plan if needed

---

## Quick Reference

### Vercel Rollback (Fastest)
```bash
# Via CLI (if installed)
vercel rollback [deployment-url]

# Or use Dashboard (recommended)
# Deployments → Previous deployment → Promote to Production
```

### Database Rollback
```bash
# Connect to production
pnpm prisma migrate deploy

# Or manually execute SQL
DROP TABLE IF EXISTS "BrandProfile";
```

### Feature Disable (Temporary)
```bash
# Add env var in Vercel Dashboard
DISABLE_BRAND_KIT_BUILDER=true

# Then redeploy
```

---

## Rollback Decision Matrix

| Issue Type | Recommended Action | Time | Data Loss Risk |
|------------|-------------------|------|----------------|
| Code bug | Option 1 (Vercel rollback) | 2-5 min | None |
| UI regression | Option 1 (Vercel rollback) | 2-5 min | None |
| API error | Option 1 (Vercel rollback) | 2-5 min | None |
| Database migration failure | Option 2 (Schema rollback) | 5-10 min | Yes* |
| Performance degradation | Option 1 (Vercel rollback) | 2-5 min | None |
| Security vulnerability | Option 1 (Vercel rollback) | 2-5 min | None |
| Gradual rollout needed | Option 3 (Feature flag) | 10-15 min | None |

\* Data loss only if BrandProfile table is dropped. Migration is additive, so usually safe to keep.

---

## Prevention Checklist (For Future Deployments)

- [ ] Run full test suite before deployment
- [ ] Test in staging environment first
- [ ] Verify database migrations are safe (additive)
- [ ] Check environment variables are set correctly
- [ ] Review rate limiting settings
- [ ] Monitor error rates after deployment
- [ ] Have rollback plan ready before deploying

---

## Emergency Contacts

- **Vercel Support:** https://vercel.com/support
- **Database Admin:** [Add contact info]
- **On-Call Engineer:** [Add contact info]

---

## Important Notes

### BrandProfile Migration Safety

The BrandProfile migration is **additive only**:
- Creates new table (`BrandProfile`)
- Adds relation to existing table (`User.brandProfile`)
- Does NOT modify existing tables or data
- Safe to keep even if code is rolled back
- No data loss risk from migration itself

### Environment Variables

Rolling back code does NOT revert environment variables. Remove manually if needed.

### Cold Start Impact

In-memory rate limiting resets on serverless cold starts. This is expected behavior, not a bug.

### RequestId Tracing

All errors include requestId. Use these to trace issues in logs before rolling back.

---

## Summary

**Recommended Rollback Approach:**
1. **First**: Option 1 (Vercel rollback) - fastest, no data loss
2. **Only if needed**: Option 2 (Database rollback) - only if migration caused issues
3. **For gradual rollout**: Option 3 (Feature flag) - temporary disable

**Database Migration:** Safe to keep (additive only). Only rollback if absolutely necessary.

---

**Last Updated:** [Update after deployment]  
**Status:** ✅ Ready for Production

