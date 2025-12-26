# Social Auto-Poster Meta Connection QA Guide

This guide provides step-by-step instructions for testing the Meta (Facebook + Instagram) connection feature in production.

## Preconditions

Before starting QA, ensure:

- [ ] **Premium User Account**: You have a premium user account with access to Social Auto-Poster
- [ ] **Meta Environment Variables**: All required Meta env vars are set in Vercel (see [`social-auto-poster-prod-verification.md`](./social-auto-poster-prod-verification.md))
- [ ] **Meta App Configuration**: Meta app is configured in Meta for Developers dashboard
- [ ] **Facebook Page Admin**: Your Facebook user is an admin of at least one Facebook Page
- [ ] **Instagram Business Account** (optional): If testing Instagram, ensure you have a Business/Creator account linked to your Facebook Page

## Meta Dashboard Setup Checklist

### 1. OAuth Redirect URIs

**Local Development:**
```
http://localhost:3000/api/social-connections/meta/callback
```

**Production:**
```
https://apps.ocalabusinessdirectory.com/api/social-connections/meta/callback
```

**Steps:**
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Select your app
3. Navigate to **Settings → Basic**
4. Under **Valid OAuth Redirect URIs**, add both URIs above
5. Click **Save Changes**

### 2. App Domains

**Required:**
- `apps.ocalabusinessdirectory.com`

**Optional:**
- `ocalabusinessdirectory.com` (parent domain)

**Steps:**
1. In the same **Settings → Basic** page
2. Under **App Domains**, add the domains above
3. Click **Save Changes**

### 3. App Roles

**Required:**
- Your Facebook user must be an **Admin** or **Developer** of the Meta app
- Your Facebook user must be an **Admin** of at least one Facebook Page

**Steps:**
1. In **Settings → Roles**
2. Ensure your Facebook user is listed as Admin or Developer
3. Verify you have admin access to at least one Facebook Page

## QA Test Script

### Step 1: Open Setup Page

1. Navigate to: `https://apps.ocalabusinessdirectory.com/apps/social-auto-poster/setup`
2. **Expected:** Page loads with "Connect Accounts" section visible
3. **Expected:** If not premium, shows upgrade prompt (🔒 icon)

### Step 2: Connect Meta Account

1. Click **"Connect"** button in the "Connect Accounts" section
2. **Expected:** Redirects to Meta OAuth consent screen
3. **Expected:** Shows requested permissions (pages_manage_posts, instagram_basic, etc.)
4. Click **"Continue"** or **"Allow"** on Meta consent screen
5. **Expected:** Redirects back to Setup page
6. **Expected:** URL shows `?connected=1` briefly, then cleans to `/apps/social-auto-poster/setup`
7. **Expected:** Success banner appears: "Meta connected successfully"
8. **Expected:** Connection status automatically refreshes (no manual refresh needed)

### Step 3: Verify Connection Status

**Facebook Status:**
- [ ] Shows "Connected ✅" with Page name in parentheses
- [ ] Shows Page ID (if available)
- [ ] "Disconnect" button is enabled

**Instagram Status:**
- [ ] If Instagram Business account is linked:
  - Shows "Connected ✅" with username (@username)
  - Shows IG Business ID (if available)
- [ ] If Instagram is NOT linked:
  - Shows "Not available: [reason]"
  - Reason explains requirement (e.g., "Facebook must be connected first" or "No IG business account linked to selected Page")

### Step 4: Send Test Post (Facebook)

1. Click **"Send Test Post"** button
2. **Expected:** Button shows "Sending..." while processing
3. **Expected:** Test post results appear below button
4. **Expected:** Facebook result shows:
   - ✅ icon if successful
   - "View Post →" link if permalink is available
   - Post ID in monospace font (if available)
   - ❌ icon and error message if failed

**Verify Post:**
- [ ] Click "View Post →" link (if present)
- [ ] **Expected:** Opens Facebook post in new tab
- [ ] **Expected:** Post shows test caption: "OBD Social Auto-Poster test post ✅ ([timestamp])"

### Step 5: Send Test Post (Instagram - if available)

**If Instagram is connected:**
1. Click **"Send Test Post"** button again
2. **Expected:** Results show both Facebook and Instagram
3. **Expected:** Instagram result shows:
   - ✅ icon if successful
   - "View Post →" link if permalink is available
   - Post ID in monospace font (if available)
   - ❌ icon and error message if failed

**Verify Post:**
- [ ] Click "View Post →" link for Instagram (if present)
- [ ] **Expected:** Opens Instagram post in new tab
- [ ] **Expected:** Post shows test caption and OBD logo image

**Partial Success Handling:**
- [ ] If FB succeeds but IG fails:
  - Shows "⚠️ Partial success" banner
  - Shows FB ✅ and IG ❌
  - Both errors are clearly displayed

### Step 6: Verify Activity Page

1. Navigate to: `https://apps.ocalabusinessdirectory.com/apps/social-auto-poster/activity`
2. **Expected:** Test post appears in activity log
3. **Expected:** Shows status: "posted" (green badge)
4. **Expected:** Shows platform: "Facebook" (or "Instagram")
5. **Expected:** Shows test post content
6. Click **"Show Delivery Attempts"** (if available)
7. **Expected:** Shows delivery attempt details
8. **Expected:** Shows "View Post →" link if permalink is available
9. **Expected:** Shows Post ID in monospace font (if available)
10. **Expected:** Clicking "View Post →" opens the post in new tab

### Step 7: Disconnect Test

1. Return to Setup page
2. Click **"Disconnect"** button
3. **Expected:** Confirmation dialog appears
4. Click **"OK"** to confirm
5. **Expected:** Success banner appears
6. **Expected:** Connection status updates to show "Not connected"
7. **Expected:** "Connect" button is enabled again

## Error Scenarios Testing

### Test: OAuth Access Denied

1. Click **"Connect"** button
2. On Meta consent screen, click **"Cancel"** or **"Don't Allow"**
3. **Expected:** Redirects back to Setup page with error
4. **Expected:** Error message: "You denied access to the required permissions. Please try again and approve all requested permissions."

### Test: No Facebook Pages

**Setup:** Use a Facebook account that is NOT an admin of any Pages

1. Click **"Connect"** button
2. Complete OAuth flow
3. **Expected:** Redirects back with error: "You must be an admin of at least one Facebook Page to use this feature."

### Test: Missing Permissions

**Setup:** Connect but deny some required permissions

1. Complete OAuth flow but deny `pages_manage_posts` permission
2. **Expected:** Connection may succeed but test post fails
3. **Expected:** Error message: "Permissions not granted. Disconnect and reconnect, ensuring you approve all requested permissions."

### Test: Instagram Not Linked

**Setup:** Connect Facebook Page that has no Instagram Business account linked

1. Complete OAuth flow
2. **Expected:** Facebook shows "Connected ✅"
3. **Expected:** Instagram shows "Not available: No IG business account linked to selected Page"
4. **Expected:** Test post only attempts Facebook (not Instagram)

## Troubleshooting Table

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Meta connection not configured" | Missing `META_APP_ID` or `META_APP_SECRET` in Vercel | Add env vars in Vercel Project Settings |
| "Redirect URI mismatch" | OAuth redirect URI not in Meta dashboard | Add exact URI to Meta app settings |
| "You must be an admin of at least one Facebook Page" | User is not admin of any Pages | Make user admin of a Facebook Page |
| "Instagram not available" | No IG Business account linked to Page | Link Instagram Business account to Facebook Page |
| "Permissions not granted" | User denied required permissions | Disconnect and reconnect, approve all permissions |
| "Token expired" | Access token expired | Disconnect and reconnect |
| "Rate limit" | Too many API requests | Wait a few minutes and try again |
| Test post fails with generic error | Check Meta API error in response | Use error mapper to show user-friendly message |
| "View Post →" link missing | Permalink not returned from API | Check Meta API response, verify post was created |

## Expected JSON Response Shapes

### Connection Status (Success)

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
    "username": "your_username",
    "igBusinessId": "123456789"
  }
}
```

### Connection Status (Instagram Not Available)

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
    "connected": false,
    "available": false,
    "reasonIfUnavailable": "No IG business account linked to selected Page"
  }
}
```

### Test Post Results (Success)

```json
{
  "ok": true,
  "results": {
    "facebook": {
      "ok": true,
      "postId": "123456789_987654321",
      "permalink": "https://www.facebook.com/permalink/to/post"
    },
    "instagram": {
      "ok": true,
      "postId": "ABC123XYZ",
      "permalink": "https://www.instagram.com/p/ABC123XYZ/"
    }
  }
}
```

### Test Post Results (Partial Success)

```json
{
  "ok": true,
  "results": {
    "facebook": {
      "ok": true,
      "postId": "123456789_987654321",
      "permalink": "https://www.facebook.com/permalink/to/post"
    },
    "instagram": {
      "ok": false,
      "error": "Instagram publishing requires a Business account and content publishing permissions."
    }
  }
}
```

## Security Verification

- [ ] No access tokens are logged in console
- [ ] No access tokens are returned in API responses
- [ ] Error messages do not expose sensitive information
- [ ] Permalinks are safe to display (public URLs only)
- [ ] Post IDs are safe to display (public identifiers only)

## Related Documentation

- [`social-auto-poster-prod-verification.md`](./social-auto-poster-prod-verification.md) - Production verification checklist
- [`social-auto-poster-env-checklist.md`](./social-auto-poster-env-checklist.md) - Environment variable checklist
- [`social-auto-poster-cron-runner.md`](./social-auto-poster-cron-runner.md) - Cron runner configuration

