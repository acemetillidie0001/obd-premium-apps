# Social Auto-Poster Production Verification Checklist

This checklist helps verify that the Meta (Facebook + Instagram) connection feature is properly configured in production.

## Quick Self-Test

**For Admin Users:**
1. Log in as admin at `https://apps.ocalabusinessdirectory.com`
2. Navigate to `/apps/social-auto-poster/setup`
3. Click "Open Meta Status JSON" button (admin-only)
4. Verify the JSON response matches expected format below

**For Non-Admin Users:**
- Visit: `https://apps.ocalabusinessdirectory.com/api/social-connections/meta/status`
- Must be logged in as premium user
- Expected: `200 OK` with JSON response

## 1. Vercel Environment Variables

Verify these environment variables are set in **Vercel Project Settings → Environment Variables** (Production):

- [ ] `META_APP_ID` - Meta (Facebook) App ID
- [ ] `META_APP_SECRET` - Meta (Facebook) App Secret
- [ ] `NEXT_PUBLIC_APP_URL` - Should be `https://apps.ocalabusinessdirectory.com`
- [ ] `NEXTAUTH_URL` - Should be `https://apps.ocalabusinessdirectory.com`
- [ ] `NEXTAUTH_SECRET` - NextAuth secret (secure random string)
- [ ] `RESEND_API_KEY` - Resend API key (starts with `re_`)
- [ ] `EMAIL_FROM` - Email sender (e.g., `OBD <support@updates.ocalabusinessdirectory.com>`)
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `CRON_SECRET` - Secret for cron runner endpoint (if using `/api/social-auto-poster/runner`)

**Note:** Variable names are case-sensitive. Ensure exact spelling.

## 2. Meta (Facebook) Dashboard Configuration

### OAuth Redirect URIs

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Select your app
3. Navigate to **Settings → Basic**
4. Under **Valid OAuth Redirect URIs**, ensure this URI is present:
   ```
   https://apps.ocalabusinessdirectory.com/api/social-connections/meta/callback
   ```

**Important:**
- Must use `https://` (not `http://`)
- Must match production domain exactly
- No trailing slashes

### App Domains

1. In the same **Settings → Basic** page
2. Under **App Domains**, add:
   - `apps.ocalabusinessdirectory.com`
   - `ocalabusinessdirectory.com` (optional, if using parent domain)

**Note:** App Domains are optional but recommended for better security.

## 3. Endpoint Behavior Verification

### Test 1: Logged Out User

**Request:**
```bash
GET https://apps.ocalabusinessdirectory.com/api/social-connections/meta/status
```

**Expected Response:**
- Status: `401 Unauthorized`
- Body:
  ```json
  {
    "ok": false,
    "errorCode": "UNAUTHORIZED",
    "error": "Unauthorized"
  }
  ```

### Test 2: Logged In Premium User (No Connection)

**Request:**
```bash
GET https://apps.ocalabusinessdirectory.com/api/social-connections/meta/status
Authorization: (session cookie)
```

**Expected Response:**
- Status: `200 OK`
- Body:
  ```json
  {
    "ok": true,
    "configured": true,
    "facebook": {
      "connected": false
    },
    "instagram": {
      "connected": false,
      "available": false,
      "reasonIfUnavailable": "Facebook must be connected first"
    }
  }
  ```

### Test 3: Logged In Premium User (With Connection)

**Expected Response:**
- Status: `200 OK`
- Body:
  ```json
  {
    "ok": true,
    "configured": true,
    "facebook": {
      "connected": true,
      "pageName": "Your Page Name",
      "pageId": "123456789"
    },
    "instagram": {
      "connected": true,
      "available": true,
      "username": "your_instagram_username",
      "igBusinessId": "123456789"
    }
  }
  ```

### Test 4: Missing Environment Variables

**Expected Response:**
- Status: `200 OK` (never returns 500)
- Body:
  ```json
  {
    "ok": false,
    "configured": false,
    "configuredReason": "missing META_APP_ID and META_APP_SECRET",
    "errorCode": "META_NOT_CONFIGURED",
    "facebook": {
      "connected": false
    },
    "instagram": {
      "connected": false,
      "available": false
    }
  }
  ```

**Note:** The `configuredReason` field indicates which environment variables are missing.

## 4. Common Issues and Fixes

### Issue: "META_NOT_CONFIGURED" Error

**Symptoms:**
- `ok: false`
- `configured: false`
- `errorCode: "META_NOT_CONFIGURED"`

**Fix:**
1. Verify `META_APP_ID` and `META_APP_SECRET` are set in Vercel
2. Ensure variable names match exactly (case-sensitive)
3. Redeploy application after adding variables
4. Check `configuredReason` field for specific missing variables

### Issue: OAuth Redirect URI Mismatch

**Symptoms:**
- Meta OAuth flow fails
- Error: "Redirect URI mismatch"

**Fix:**
1. Verify redirect URI in Meta dashboard matches exactly:
   `https://apps.ocalabusinessdirectory.com/api/social-connections/meta/callback`
2. Ensure no trailing slashes or typos
3. Save changes in Meta dashboard
4. Try OAuth flow again

### Issue: "UNAUTHORIZED" for Logged In Users

**Symptoms:**
- `401 Unauthorized` even when logged in

**Fix:**
1. Verify session cookies are being sent
2. Check `NEXTAUTH_SECRET` is set correctly
3. Verify `NEXTAUTH_URL` matches production domain
4. Clear browser cookies and log in again

### Issue: "PREMIUM_REQUIRED" Error

**Symptoms:**
- `403 Forbidden`
- `errorCode: "PREMIUM_REQUIRED"`

**Fix:**
- This is expected for non-premium users
- User must upgrade to premium to use Meta connection feature

## 5. Production Deployment Checklist

Before deploying to production:

- [ ] All environment variables set in Vercel (see section 1)
- [ ] Meta OAuth redirect URI configured (see section 2)
- [ ] Meta App Domains configured (see section 2)
- [ ] Test endpoint returns `ok: true, configured: true` for premium users
- [ ] Test OAuth flow completes successfully
- [ ] Test post publishing works
- [ ] Verify no secrets are logged in production logs

## 6. Security Notes

- **Never log tokens or secrets** - The endpoint never returns access tokens
- **Never expose API keys** - Environment variables are server-side only
- **Admin debug link** - Only visible to admin users, opens JSON in new tab
- **Structured errors** - All errors return `200 OK` with structured JSON (no 500s)

## Related Documentation

- [`docs/apps/social-auto-poster-env-checklist.md`](./social-auto-poster-env-checklist.md) - Environment variable checklist
- [`docs/apps/social-auto-poster-cron-runner.md`](./social-auto-poster-cron-runner.md) - Cron runner configuration
- [`docs/local-dev-env.md`](../local-dev-env.md) - Local development setup

