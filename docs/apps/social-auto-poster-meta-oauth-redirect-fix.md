# Meta OAuth Redirect URI Fix

## Summary

Fixed Meta OAuth `redirect_uri` generation to work with HTTPS ngrok URLs in local development and production domains automatically.

## Changes Made

### Files Modified

1. **`src/lib/apps/social-auto-poster/getBaseUrl.ts`** (NEW)
   - Created centralized base URL helper function
   - Priority: `NEXTAUTH_URL` → `NEXT_PUBLIC_APP_URL` → `request.nextUrl.origin` (fallback)

2. **`src/app/api/social-connections/meta/connect/route.ts`**
   - Removed hardcoded `NEXT_PUBLIC_APP_URL` dependency
   - Now uses `getBaseUrl()` helper
   - `redirect_uri` is built dynamically: `${baseUrl}/api/social-connections/meta/callback`

3. **`src/app/api/social-connections/meta/callback/route.ts`**
   - Removed hardcoded `NEXT_PUBLIC_APP_URL` dependency
   - Now uses `getBaseUrl(request.nextUrl.origin)` helper
   - `redirect_uri` for token exchange uses the same base URL (ensures consistency)

## Base URL Logic

The `getBaseUrl()` function uses the following priority:

1. **`NEXTAUTH_URL`** (or `AUTH_URL` for NextAuth v5) - **Preferred**
   - Used when set in environment variables
   - Supports ngrok HTTPS URLs for local development
   - Production: `https://apps.ocalabusinessdirectory.com`

2. **`NEXT_PUBLIC_APP_URL`** - **Fallback**
   - Used if `NEXTAUTH_URL` is not set
   - Production: `https://apps.ocalabusinessdirectory.com`

3. **`request.nextUrl.origin`** - **Last Resort** (callback only)
   - Only available in callback handlers
   - Used if neither env var is set (should not happen in production)

## Security

- ✅ No tokens, secrets, auth codes, or full redirect URLs are logged
- ✅ No hardcoded localhost URLs
- ✅ Production continues to use `https://apps.ocalabusinessdirectory.com` automatically via env vars
- ✅ Local dev supports HTTPS via ngrok without code changes

## Local development with ngrok (HTTPS required)

Meta is enforcing HTTPS for redirect URIs, so local testing must use an HTTPS URL (ngrok).

1) **Start ngrok:**

```bash
ngrok http 3000
```

2) **Copy the HTTPS forwarding URL**

In the ngrok output, find the line that looks like:

Format: `https://<subdomain>.ngrok-free.dev`

Example: `https://unsatiating-distorted-lita.ngrok-free.dev`

3) **Update `.env.local`**

Set:

```env
NEXTAUTH_URL=https://<subdomain>.ngrok-free.dev
```

(Optional, only if the app uses it)

```env
NEXT_PUBLIC_APP_URL=https://<subdomain>.ngrok-free.dev
```

4) **Add the Meta redirect URI**

Meta Dashboard → Facebook Login → Settings → Valid OAuth Redirect URIs

Add:

```
https://<subdomain>.ngrok-free.dev/api/social-connections/meta/callback
```

Keep production:

```
https://apps.ocalabusinessdirectory.com/api/social-connections/meta/callback
```

5) **Restart dev server**

```bash
pnpm dev
```

6) **Test**

Open:

```
https://<subdomain>.ngrok-free.dev/apps/social-auto-poster/setup
```

Click Connect Facebook and verify the Facebook OAuth URL contains:

```
redirect_uri=https%3A%2F%2F<subdomain>.ngrok-free.dev%2Fapi%2Fsocial-connections%2Fmeta%2Fcallback
```

That's it. This removes any ambiguity and makes future troubleshooting way easier.

---

## Now: proceed with the real test (Meta staged permissions)

Since your code changes are in:

1) Start ngrok  
2) Set `NEXTAUTH_URL` to your actual `https://...ngrok-free.dev`  
3) Restart `pnpm dev`  
4) Load the setup page via ngrok URL  
5) Click:
   - **Connect Facebook** (Stage 1)
   - then **Enable Pages Access** (Stage 2)

If you want the fastest debug after you try Stage 1: open your status endpoint and paste the JSON (no secrets):

```
https://<subdomain>.ngrok-free.dev/api/social-connections/meta/status
```

Tell me:
- Did Stage 1 succeed?
- Did Stage 2 succeed?
- If any error, paste the exact error text.

### Production

1. **Verify environment variables in Vercel:**
   - `NEXTAUTH_URL` = `https://apps.ocalabusinessdirectory.com`
   - OR `NEXT_PUBLIC_APP_URL` = `https://apps.ocalabusinessdirectory.com`

2. **Test Meta OAuth connection:**
   - Navigate to `https://apps.ocalabusinessdirectory.com/apps/social-auto-poster/setup`
   - Click "Connect" for Facebook
   - **Verify:** The OAuth redirect URL should show:
     ```
     https://apps.ocalabusinessdirectory.com/api/social-connections/meta/callback
     ```
   - Complete the OAuth flow
   - **Verify:** Callback redirects back to production domain successfully

3. **Verify redirect_uri in Meta OAuth request:**
   - Open browser DevTools → Network tab
   - Click "Connect" for Facebook
   - Find the request to `facebook.com/dialog/oauth`
   - **Verify:** `redirect_uri` parameter is:
     ```
     https://apps.ocalabusinessdirectory.com/api/social-connections/meta/callback
     ```

## Troubleshooting

### Issue: "Base URL not configured" error

**Solution:** Set `NEXTAUTH_URL` or `NEXT_PUBLIC_APP_URL` in `.env.local` (local) or Vercel (production).

### Issue: OAuth callback fails with "redirect_uri mismatch"

**Solution:** 
1. Ensure the `redirect_uri` in the OAuth request matches exactly what's configured in Meta App Settings
2. Update Meta App Settings → Facebook Login → Valid OAuth Redirect URIs:
   - Local: `https://<subdomain>.ngrok-free.dev/api/social-connections/meta/callback`
   - Production: `https://apps.ocalabusinessdirectory.com/api/social-connections/meta/callback`
   - Replace `<subdomain>` with your actual ngrok subdomain

### Issue: Still seeing localhost in redirect_uri

**Solution:**
1. Check `.env.local` has `NEXTAUTH_URL` or `NEXT_PUBLIC_APP_URL` set
2. Restart the dev server after updating `.env.local`
3. Clear browser cache and try again

## Verification

- ✅ No hardcoded `localhost:3000` or `http://localhost` URLs in Meta OAuth code
- ✅ `redirect_uri` is built dynamically using `getBaseUrl()`
- ✅ Production uses `https://apps.ocalabusinessdirectory.com` automatically
- ✅ Local dev supports ngrok HTTPS URLs via `NEXTAUTH_URL`
- ✅ No tokens or secrets logged in console or error messages

