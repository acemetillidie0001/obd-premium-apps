# Canonical Host + Demo Mode Verification Guide

## Implementation Summary

### Changes Made

1. **Middleware Canonical Host Enforcement** (`src/middleware.ts`)
   - Added canonical host redirect at the top of middleware (before auth checks)
   - In production, redirects `/apps` and `/apps/*` routes to `apps.ocalabusinessdirectory.com`
   - Only runs in production (`NODE_ENV === "production"`)

2. **Demo Entry Route** (`src/app/apps/demo/route.ts`)
   - In production: Always redirects to `https://apps.ocalabusinessdirectory.com/apps`
   - Sets demo cookie on redirect response using `setDemoCookie(response.cookies)`
   - Cookie domain: `.ocalabusinessdirectory.com` (cross-subdomain support)

3. **Demo Exit Route** (`src/app/apps/demo/exit/route.ts`)
   - In production: Always redirects to `https://apps.ocalabusinessdirectory.com/apps`
   - Clears demo cookie on redirect response using `clearDemoCookie(response.cookies)`
   - Uses same domain/path options as when setting cookie

4. **Cookie Options Verified** (`src/lib/demo/demo-cookie.ts`)
   - ✅ `domain: ".ocalabusinessdirectory.com"` (production only)
   - ✅ `path: "/"`
   - ✅ `secure: true` (production only)
   - ✅ `httpOnly: true`
   - ✅ `sameSite: "lax"`

## Expected Flow

### Test Case 1: Visit `/apps/demo` from Main Domain

**Request:** `https://ocalabusinessdirectory.com/apps/demo`

**Expected Flow:**
1. Middleware detects `/apps/demo` is an apps route on non-canonical host
2. Middleware redirects to `https://apps.ocalabusinessdirectory.com/apps/demo` (preserves pathname)
3. Route handler sets cookie with domain `.ocalabusinessdirectory.com` and redirects to `/apps`
4. User lands at `https://apps.ocalabusinessdirectory.com/apps` with demo cookie set
5. Demo banner displays (checked by `ConditionalLayout` using `hasDemoCookie()`)

**Expected Result:**
- ✅ URL: `https://apps.ocalabusinessdirectory.com/apps`
- ✅ Demo banner visible (amber/orange banner at top)
- ✅ Cookie `obd_demo=1` set with domain `.ocalabusinessdirectory.com`

---

### Test Case 2: Navigate to App in Demo Mode

**Action:** Click `/apps/business-description-writer` link

**Expected Flow:**
1. Middleware checks `/apps/business-description-writer`
2. Middleware detects demo cookie via `hasDemoCookie(req)` (raw Cookie header parsing)
3. Middleware allows access without authentication
4. Page loads normally

**Expected Result:**
- ✅ No redirect to `/login`
- ✅ Page loads successfully
- ✅ Demo banner still visible
- ✅ Demo mode features active (view-only)

---

### Test Case 3: Hard Refresh on App Route

**Action:** Hard refresh (`Ctrl+Shift+R` or `Cmd+Shift+R`) on `https://apps.ocalabusinessdirectory.com/apps/business-description-writer`

**Expected Flow:**
1. Request includes `Cookie: obd_demo=1` header
2. Middleware detects demo cookie via raw Cookie header parsing
3. Middleware allows access
4. Layout checks cookie via `hasDemoCookie(cookieStore)` (server-side)
5. Demo banner renders

**Expected Result:**
- ✅ Page still loads in demo mode
- ✅ No redirect to `/login`
- ✅ Demo banner persists
- ✅ Cookie still present and valid

---

## Verification Checklist (Incognito Browser)

### Prerequisites
- Use incognito/private browsing window
- Clear all cookies before starting
- Ensure you're testing on production environment

### Step 1: Demo Entry
- [ ] Visit: `https://ocalabusinessdirectory.com/apps/demo`
- [ ] Observe: Redirect to `https://apps.ocalabusinessdirectory.com/apps`
- [ ] Verify: Demo banner is visible (amber/orange banner at top)
- [ ] Verify: Banner text says "Demo Mode: View-only preview. Upgrade to generate, save, or publish."
- [ ] Check DevTools → Application → Cookies → `apps.ocalabusinessdirectory.com`
- [ ] Verify: Cookie `obd_demo` exists with:
  - Value: `1`
  - Domain: `.ocalabusinessdirectory.com`
  - Path: `/`
  - HttpOnly: ✅ (checked)
  - Secure: ✅ (checked, HTTPS only)
  - SameSite: `Lax`

### Step 2: Navigate to App
- [ ] Click on "Business Description Writer" or navigate to `/apps/business-description-writer`
- [ ] Verify: NO redirect to `/login`
- [ ] Verify: Page loads successfully
- [ ] Verify: Demo banner still visible
- [ ] Verify: URL is `https://apps.ocalabusinessdirectory.com/apps/business-description-writer`

### Step 3: Hard Refresh
- [ ] Perform hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- [ ] Verify: Still on `https://apps.ocalabusinessdirectory.com/apps/business-description-writer`
- [ ] Verify: NO redirect to `/login`
- [ ] Verify: Page loads successfully
- [ ] Verify: Demo banner still visible
- [ ] Check DevTools → Network → Request Headers
- [ ] Verify: `Cookie: obd_demo=1` is sent with request

### Step 4: Cookie Persistence Check
- [ ] Navigate to another app: `/apps/social-media-post-creator`
- [ ] Verify: Demo banner persists
- [ ] Verify: No login redirect
- [ ] Check DevTools → Application → Cookies
- [ ] Verify: Cookie still exists with correct domain/path

---

## Troubleshooting

### Issue: Cookie not being set
- **Check:** Is the redirect happening to canonical host?
- **Check:** Cookie domain should be `.ocalabusinessdirectory.com` (note the leading dot)
- **Check:** In DevTools, ensure cookie shows for `apps.ocalabusinessdirectory.com` domain
- **Verify:** Production environment (`NODE_ENV === "production"`)

### Issue: Redirect loop
- **Check:** Middleware should redirect `/apps/demo` to canonical host first
- **Check:** Route handler should then redirect to `/apps` (not back to `/apps/demo`)
- **Verify:** No infinite redirect chain

### Issue: Demo banner not showing
- **Check:** Cookie exists with correct name `obd_demo`
- **Check:** Cookie value is `1` (not empty)
- **Check:** `ConditionalLayout` receives `isDemo={true}` prop
- **Check:** Route is `/apps` or `/apps/*` (banner only shows on apps routes)
- **Verify:** `hasDemoCookie(cookieStore)` returns `true` in layout

### Issue: Still redirecting to login
- **Check:** Middleware uses raw Cookie header parsing (`req.headers.get("cookie")`)
- **Check:** Cookie is being sent with request (check Network tab)
- **Check:** Cookie domain matches request domain (`.ocalabusinessdirectory.com` works for subdomains)
- **Verify:** Middleware `hasDemoCookie(req)` function is correctly parsing cookie

---

## Code Flow Reference

### Cookie Detection (Middleware)
```typescript
// src/middleware.ts - hasDemoCookie function
function hasDemoCookie(req: NextRequest): boolean {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)obd_demo=([^;]+)/);
  return !!(m && m[1] && m[1].trim() !== "");
}
```

### Cookie Detection (Layout)
```typescript
// src/app/layout.tsx
const cookieStore = await cookies();
const isDemo = hasDemoCookie(cookieStore); // Uses Next.js cookies() API
```

### Demo Banner Display
```typescript
// src/components/layout/ConditionalLayout.tsx
{isDemo && isAppsRoute && <DemoBanner isDemo={isDemo} />}
```

---

## Production Deployment Notes

- Ensure `NODE_ENV=production` is set in production environment
- Cookie domain `.ocalabusinessdirectory.com` enables cross-subdomain cookies
- Canonical host redirect only runs in production (development allows any host)
- All redirects preserve query parameters automatically

