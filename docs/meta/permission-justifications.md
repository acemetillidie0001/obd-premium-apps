# Meta Permission Justifications

This document explains why the OBD Social Auto-Poster requests each Meta permission and how they are used in the application.

## Permissions Requested

### 1. `public_profile` (Basic Profile Information)

**Why we need it:**
- To identify the user's Facebook account during OAuth connection
- To display the connected account name in the UI
- To verify the user owns the account they're connecting

**Where it's used:**
- OAuth callback: `/api/social-connections/meta/callback`
- Connection status display: `/apps/social-auto-poster/setup`
- User identification in database: `SocialAccountConnection.displayName`

**What we store:**
- User's Facebook name (display name only)
- Facebook user ID (for account identification)
- We do NOT store: email, profile picture, or any other profile data

**User control:**
- Users can disconnect at any time via the "Disconnect Facebook" button
- Disconnection immediately removes all stored data

---

### 2. `pages_show_list` (View Your Pages)

**Why we need it:**
- To display a list of Facebook Pages the user manages
- To allow the user to select which Page they want to post to
- To verify the user has permission to manage the selected Page

**Where it's used:**
- OAuth callback: Fetches user's Pages after connection
- Setup page: Displays available Pages for selection
- Page selection: User chooses which Page to use for posting

**What we store:**
- Selected Page ID (for posting target)
- Selected Page name (for display in UI)
- We do NOT store: Full list of Pages, Page settings, or any other Page data

**User control:**
- Users can change their selected Page at any time
- Users can disconnect to revoke all permissions

---

### 3. `pages_read_engagement` (Read Page Insights)

**Why we need it:**
- To verify the user has sufficient permissions to manage the Page
- To ensure the selected Page is accessible for posting
- Required by Meta before `pages_manage_posts` can be granted

**Where it's used:**
- Permission verification during OAuth flow
- Page access validation before allowing posting

**What we store:**
- We do NOT store any Page insights or engagement data
- This permission is only used for verification, not data collection

**User control:**
- Users can disconnect to revoke this permission

---

### 4. `pages_manage_posts` (Publish Posts to Pages) - **Future Permission**

**Why we need it:**
- To publish posts to the user's selected Facebook Page
- To schedule posts for future publication
- To manage post content on behalf of the user

**Where it will be used:**
- Publishing service: `src/lib/apps/social-auto-poster/publishers/metaPublisher.ts`
- Scheduled post runner: `/api/social-auto-poster/runner`
- Test post functionality: `/api/social-connections/meta/test-post`

**What we will store:**
- Post content (text and optional image URL)
- Scheduled post time (if applicable)
- Post status (draft, scheduled, posted, failed)
- Provider post ID (for linking to published posts)
- We do NOT store: Post engagement metrics, comments, or any post analytics

**User control:**
- Users can delete queued posts before they're published
- Users can disconnect to stop all future posting
- Users can revoke permission in Facebook Settings at any time

---

### 5. `instagram_content_publish` (Publish to Instagram) - **Future Permission**

**Why we need it:**
- To publish posts to the user's Instagram Business account
- To publish photos and captions to Instagram
- To schedule Instagram posts for future publication

**Where it will be used:**
- Publishing service: `src/lib/apps/social-auto-poster/publishers/metaPublisher.ts`
- Scheduled post runner: `/api/social-auto-poster/runner`
- Test post functionality: `/api/social-connections/meta/test-post`

**What we will store:**
- Post content (caption text and image URL)
- Scheduled post time (if applicable)
- Post status (draft, scheduled, posted, failed)
- Provider post ID (for linking to published posts)
- We do NOT store: Post engagement metrics, comments, or any post analytics

**User control:**
- Users can delete queued posts before they're published
- Users can disconnect to stop all future posting
- Users can revoke permission in Facebook Settings at any time

---

## Permissions NOT Requested

We do NOT request:
- `email` - We don't need user email addresses
- `user_posts` - We don't read user's existing posts
- `user_photos` - We don't access user's photos
- `manage_pages` - We don't modify Page settings
- `business_management` - We don't access Business Manager data
- Any permissions that allow reading user data beyond what's necessary for posting

---

## Data Storage and Privacy

### What We Store:
1. **OAuth Tokens:**
   - Access tokens (encrypted in database)
   - Refresh tokens (if provided by Meta)
   - Token expiration timestamps

2. **Connection Metadata:**
   - User ID (internal)
   - Platform (facebook/instagram)
   - Provider account ID (Facebook user/Page ID)
   - Display name (for UI)
   - Selected Page/Account ID (for posting target)

3. **Post Data:**
   - Post content (text)
   - Image URLs (hosted by us, not Meta)
   - Scheduled times
   - Post status and delivery attempts

### What We DON'T Store:
- User passwords (we never have access to these)
- User's existing posts or content
- Page insights or analytics data
- User's friend list or social connections
- Any data beyond what's necessary for the posting functionality

### Data Deletion:
- Users can disconnect at any time, which immediately deletes all stored tokens and connection data
- Users can request full data deletion via: support@ocalabusinessdirectory.com
- We process deletion requests promptly (typically within 7 business days)

---

## User Consent and Control

### During Connection:
- Users see Meta's consent screen explaining what permissions are requested
- Users can decline any permission request
- Users can revoke permissions in Facebook Settings at any time

### After Connection:
- Users can disconnect via the "Disconnect Facebook" button in the app
- Disconnection immediately stops all posting and deletes stored tokens
- Users can reconnect at any time

### Data Access:
- Users can view their connection status and selected Page in the app
- Users can view their post history in the Activity log
- Users can request data deletion at any time

---

## Security Measures

1. **Token Storage:**
   - Tokens are encrypted at rest in the database
   - Tokens are never logged or exposed in error messages
   - Tokens are only transmitted over HTTPS

2. **API Security:**
   - All API routes require authentication
   - Premium access required for social connections
   - CSRF protection via state parameter in OAuth flow

3. **Error Handling:**
   - No tokens or secrets in error messages
   - Safe error messages that don't expose internal details
   - Comprehensive logging (without sensitive data)

---

## Compliance

- **GDPR:** Users can request data deletion at any time
- **CCPA:** Users can opt out of data collection by disconnecting
- **Meta Platform Policy:** We comply with all Meta Platform policies and terms
- **Terms of Service:** Available at `/legal/terms`
- **Privacy Policy:** Available at `/legal/privacy`

---

## Review Process

This app is designed to be transparent and user-friendly:
- Clear permission explanations in the UI
- Easy disconnect functionality
- Comprehensive error handling
- No hidden data collection
- Full user control over their data

For questions or concerns, contact: support@ocalabusinessdirectory.com

