# Authentication Subdomain Fix

## Issue
Users can sign in via email link, but after clicking the link they're redirected back to the login page. When clicking app links, they get redirected to login again. This works on localhost but fails on the subdomain (apps.ocalabusinessdirectory.com).

## Root Cause
The issue is likely related to:
1. **AUTH_URL environment variable** - Must be set to the exact subdomain URL
2. **Cookie domain configuration** - Cookies need to be set with the parent domain for subdomain support

## Solution

### 1. Environment Variables (Vercel Production)

Ensure these are set correctly in Vercel:

```bash
AUTH_URL=https://apps.ocalabusinessdirectory.com
AUTH_COOKIE_DOMAIN=.ocalabusinessdirectory.com  # Note the leading dot
AUTH_SECRET=<your-secret>
AUTH_TRUST_HOST=true
```

**Important:**
- `AUTH_URL` must match the exact subdomain URL (https://apps.ocalabusinessdirectory.com)
- `AUTH_COOKIE_DOMAIN` should be `.ocalabusinessdirectory.com` (with leading dot) to allow cookies to work across subdomains
- Do NOT set `AUTH_COOKIE_DOMAIN` in local development (leave it unset)

### 2. Code Changes Applied

Updated `src/lib/auth.ts` to:
- Configure cookies with explicit domain settings for production
- Use `AUTH_COOKIE_DOMAIN` environment variable when set
- Keep cookies working correctly in local development (no domain set)

### 3. Testing Steps

1. **Check environment variables:**
   - Visit `/api/debug/env-check` to verify AUTH_URL is set correctly
   - Verify AUTH_COOKIE_DOMAIN is set to `.ocalabusinessdirectory.com` in production

2. **Test authentication flow:**
   - Sign in via email link
   - After clicking the link, verify you're redirected to the app (not back to login)
   - Click on an app link (e.g., Business Schema Generator)
   - Verify you can access the app without being redirected to login

3. **Check browser cookies:**
   - Open DevTools → Application → Cookies
   - Verify `next-auth.session-token` cookie exists
   - Verify cookie domain is `.ocalabusinessdirectory.com` (in production)
   - Verify cookie is `HttpOnly`, `Secure`, and `SameSite=Lax`

### 4. If Still Not Working

1. **Clear all cookies** for the domain and try again
2. **Check Vercel logs** for any authentication errors
3. **Verify AUTH_URL** matches exactly: `https://apps.ocalabusinessdirectory.com` (no trailing slash)
4. **Check middleware** is reading the token correctly (see `src/middleware.ts`)

## Technical Details

### Cookie Configuration
- Session cookies are set with domain `.ocalabusinessdirectory.com` in production
- This allows cookies to be accessible on all subdomains (apps.*, www.*, etc.)
- CSRF token cookies do NOT have domain set (security best practice)

### NextAuth v5 Behavior
- NextAuth v5 uses `AUTH_URL` to determine callback URLs
- If `AUTH_URL` is incorrect, callbacks will redirect to the wrong domain
- `trustHost: true` allows NextAuth to trust the host header (needed for Vercel)

## Related Files
- `src/lib/auth.ts` - Auth configuration with cookie settings
- `src/middleware.ts` - Route protection middleware
- `src/app/login/page.tsx` - Login page with callback URL handling

