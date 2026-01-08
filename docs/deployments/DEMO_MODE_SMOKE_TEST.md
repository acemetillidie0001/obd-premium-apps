# Demo Mode Smoke Test Checklist

**Purpose:** Verify demo mode cookie flow works end-to-end across subdomains and all `/apps/*` routes.

**Prerequisites:**
- Incognito/private browsing window (no existing cookies)
- Production or staging environment deployed with latest changes

---

## Test Steps

### 1. Demo Entry & Status Check

- [ ] Visit `/apps/demo/status`
  - **Expected:** Page loads showing:
    - Host: current hostname
    - Pathname: `/apps/demo/status`
    - Demo Cookie (obd_demo): **✓ Present**
  - **Verify:** Server-side cookie detection working

### 2. Apps Launcher & Middleware Headers

- [ ] Visit `/apps` (should auto-redirect if cookie was set)
  - **Expected:** Apps launcher loads (no redirect to `/login`)
  - **Verify:** Check browser DevTools → Network tab → Response Headers:
    - `x-obd-path: /apps`
    - `x-obd-demo: 1`
    - `x-obd-protected: 1`

### 3. App Page Navigation (Demo Cookie Bypass)

- [ ] Click 3 different app tiles from the launcher
  - **Suggested apps:**
    - `/apps/review-responder`
    - `/apps/content-writer`
    - `/apps/business-description-writer`
  
  **For each app page:**
  - **Expected:** Page loads successfully (no redirect to `/login`)
  - **Verify:** Check browser DevTools → Network tab → Response Headers:
    - `x-obd-path: /apps/[app-name]`
    - `x-obd-demo: 1`
    - `x-obd-protected: 1`

### 4. API Route Demo Blocking

- [ ] On any app page, attempt a generate/submit action (e.g., fill form and submit)
  - **Expected:** API returns `403 Forbidden` with:
    ```json
    {
      "error": "DEMO_READ_ONLY",
      "message": "Demo Mode is view-only."
    }
  - **Verify:** 
    - No API costs incurred
    - Demo toast/banner shows appropriate message
    - UI handles error gracefully

### 5. Demo Exit & Cookie Cleanup

- [ ] Visit `/apps/demo/exit` OR click "Exit Demo" button (if present)
  - **Expected:** 
    - Redirects to `https://ocalabusinessdirectory.com/premium/dashboard-preview/`
    - Demo cookie cleared
  
- [ ] After exit, visit `/apps` again
  - **Expected:** Redirects to `/login?callbackUrl=/apps`
  - **Verify:** 
    - No demo cookie present
    - Normal authentication required

---

## Cross-Subdomain Verification (Optional)

If testing across subdomains:

- [ ] Visit `https://ocalabusinessdirectory.com/apps/demo`
  - **Expected:** Cookie set with `domain: .ocalabusinessdirectory.com`
  
- [ ] Navigate to `https://apps.ocalabusinessdirectory.com/apps`
  - **Expected:** Apps launcher loads (cookie available across subdomains)
  - **Verify:** `x-obd-demo: 1` header present

---

## Post-Verification Cleanup

**⚠️ REMOVE TEMP DEBUG HEADERS + status page after verification:**

- [ ] Remove debug headers from `src/middleware.ts`:
  - Remove `addDebugHeaders()` function
  - Remove `x-obd-path`, `x-obd-demo`, `x-obd-protected` header setting
  - Remove `// TEMP DEBUG HEADERS — REMOVE AFTER DEMO VERIFIED` comments

- [ ] Delete `src/app/apps/demo/status/page.tsx`

- [ ] Commit cleanup:
  ```bash
  git commit -m "chore(demo): remove temporary debug headers and status page"
  ```

---

## Expected Behavior Summary

✅ **Demo mode should:**
- Set cookie with cross-subdomain support (production)
- Bypass authentication for all `/apps` and `/apps/*` routes
- Block all cost-incurring API routes (403)
- Clear cookie properly on exit
- Require normal auth after exit

❌ **Demo mode should NOT:**
- Redirect to `/login` when cookie is present
- Allow API mutations (POST/PUT/PATCH/DELETE)
- Allow cookie to persist after exit
- Work in development with different domain restrictions

---

**Test Date:** _______________

**Tester:** _______________

**Environment:** _______________

**Notes:**

_______________________________________________
_______________________________________________
_______________________________________________

