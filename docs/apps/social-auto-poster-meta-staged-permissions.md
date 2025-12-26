# Meta OAuth Staged Permissions Implementation

## Summary

Implemented a staged permission strategy for Meta OAuth to avoid "Invalid Scopes" errors. The connection process is now split into stages:

1. **Stage 1: Basic Connect** - Requests only `public_profile` scope
2. **Stage 2: Pages Access** - Requests `pages_show_list` and `pages_read_engagement` scopes
3. **Stage 3: Publishing** - Future (requires Advanced Access / App Review)

## Changes Made

### Files Modified

1. **`src/app/api/social-connections/meta/connect/route.ts`**
   - Changed scopes from full list to only `["public_profile"]`
   - Removed: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`

2. **`src/app/api/social-connections/meta/callback/route.ts`**
   - Updated to handle both basic connect and pages access requests
   - Basic connect: Stores user-level connection with basic info
   - Pages access: Updates connection with page token and pages access info
   - Removed Instagram discovery logic (not available until publishing permissions)

3. **`src/app/api/social-connections/meta/request-pages-access/route.ts`** (NEW)
   - New endpoint for Stage 2: requesting pages access
   - Requests only: `pages_show_list`, `pages_read_engagement`
   - Verifies basic connection exists before allowing pages access request

4. **`src/app/api/social-connections/meta/status/route.ts`**
   - Updated to show staged permissions:
     - `facebook.basicConnectGranted`: Basic connection status
     - `facebook.pagesAccessGranted`: Pages access status
     - `publishing.enabled`: Publishing status (always false for now)
     - `publishing.reasonIfDisabled`: Explanation about Advanced Access / App Review

5. **`src/app/apps/social-auto-poster/setup/page.tsx`**
   - Updated connection status type to include staged permissions
   - Added "Enable Pages Access" button (shown only after basic connect)
   - Updated UI to show:
     - Basic connection status
     - Pages access status
     - Publishing status with helper text
   - Updated "Send Test Post" button to require pages access

### Files Removed

- All references to `instagram_basic`, `instagram_content_publish`, `instagram_manage_posts`, `business_management`, and `pages_manage_posts` scopes have been removed from the codebase.

## Scopes Defined

### Stage 1: Basic Connect
**Location:** `src/app/api/social-connections/meta/connect/route.ts`
```typescript
const scopes = ["public_profile"].join(",");
```

### Stage 2: Pages Access
**Location:** `src/app/api/social-connections/meta/request-pages-access/route.ts`
```typescript
const scopes = ["pages_show_list", "pages_read_engagement"].join(",");
```

### Stage 3: Publishing (Future)
**Not yet implemented.** Will require:
- `pages_manage_posts` (requires Advanced Access / App Review)
- `instagram_content_publish` (requires Advanced Access / App Review)
- `business_management` (may be required for Instagram)

## Manual Test Checklist

### a) Basic Connect Works via ngrok HTTPS NEXTAUTH_URL

1. **Setup:**
   - Start ngrok: `ngrok http 3000`
   - Note the HTTPS URL from the "Forwarding https://..." line (e.g., `https://abc123.ngrok-free.dev`)
   - Update `.env.local`: `NEXTAUTH_URL=https://abc123.ngrok-free.dev`
   - Restart dev server: `pnpm dev`

2. **Test Basic Connect:**
   - Navigate to `/apps/social-auto-poster/setup`
   - Click "Connect Facebook"
   - **Verify:** OAuth dialog shows only basic permissions (public_profile)
   - Complete OAuth flow
   - **Verify:** Redirects back to setup page with `?connected=1`
   - **Verify:** UI shows "Basic connection ✅"
   - **Verify:** "Enable Pages Access" button appears

3. **Verify in Network Tab:**
   - Open DevTools → Network
   - Click "Connect Facebook"
   - Find request to `facebook.com/dialog/oauth`
   - **Verify:** `scope` parameter is `public_profile` only
   - **Verify:** `redirect_uri` uses ngrok HTTPS URL

### b) Pages Access Step Works or Returns Clear Message if Meta Blocks It

1. **Test Pages Access Request:**
   - After basic connect succeeds, click "Enable Pages Access"
   - **Verify:** OAuth dialog shows pages permissions (`pages_show_list`, `pages_read_engagement`)
   - Complete OAuth flow
   - **Verify:** Redirects back to setup page with `?pages_access=1`
   - **Verify:** UI shows "Pages access enabled ✅"
   - **Verify:** "Send Test Post" button becomes enabled

2. **Test if Meta Blocks Pages Access:**
   - If Meta blocks the request (e.g., app not approved for pages permissions):
     - **Verify:** OAuth callback returns with error
     - **Verify:** UI shows clear error message
     - **Verify:** Connection status shows "Pages access not enabled" with explanation

3. **Verify Pages Access in Network Tab:**
   - Open DevTools → Network
   - Click "Enable Pages Access"
   - Find request to `facebook.com/dialog/oauth`
   - **Verify:** `scope` parameter is `pages_show_list,pages_read_engagement`
   - **Verify:** `redirect_uri` uses ngrok HTTPS URL

### Additional Verification

1. **Verify Status Endpoint:**
   - Call `GET /api/social-connections/meta/status`
   - **Verify:** Response includes:
     ```json
     {
       "facebook": {
         "connected": true,
         "basicConnectGranted": true,
         "pagesAccessGranted": true/false,
         ...
       },
       "publishing": {
         "enabled": false,
         "reasonIfDisabled": "..."
       }
     }
     ```

2. **Verify No Instagram Scopes:**
   - Search codebase for `instagram_basic`, `instagram_content_publish`, `instagram_manage_posts`
   - **Verify:** No matches found (except in this documentation)

3. **Verify No Publishing Scopes:**
   - Search codebase for `pages_manage_posts`
   - **Verify:** No matches found (except in this documentation)

4. **Verify Test Post Requires Pages Access:**
   - With basic connect only (no pages access):
     - **Verify:** "Send Test Post" button is disabled
     - **Verify:** Tooltip shows "Enable Pages Access first"
   - With pages access enabled:
     - **Verify:** "Send Test Post" button is enabled
     - **Verify:** Test post can be sent successfully

## Troubleshooting

### Issue: "Invalid Scopes" error on basic connect

**Solution:** Verify that only `public_profile` is requested in the connect route. Check Meta App Settings to ensure `public_profile` is an approved scope.

### Issue: Pages access request fails with "Invalid Scopes"

**Solution:** 
1. Check Meta App Settings → Permissions → Pages permissions
2. Ensure `pages_show_list` and `pages_read_engagement` are added to the app
3. These permissions may require App Review for production use

### Issue: Pages access granted but pages not showing

**Solution:**
1. Verify user has pages associated with their Facebook account
2. Check that the user has admin/editor access to at least one page
3. Verify the access token has the correct permissions

### Issue: Test post fails even with pages access

**Solution:**
- Test posts require `pages_manage_posts` permission, which is not yet requested
- This is expected behavior - publishing requires Stage 3 (Advanced Access / App Review)

## Security

- ✅ No tokens, secrets, auth codes, or full redirect URLs are logged
- ✅ All OAuth state is validated via signed cookies
- ✅ CSRF protection via state parameter
- ✅ Permission scopes stored in `metaJson` for tracking (no sensitive data)

