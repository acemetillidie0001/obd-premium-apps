# Meta Test Post Implementation - Phase 2A1 Prompt #2

## Summary

This implementation adds a "Send Test Post" feature to verify real publishing to Facebook Pages and Instagram accounts. Users can manually test their connections by publishing a test post directly from the setup page.

## Changes Made

### 1. Database Schema (Prisma)

**New Model:**
- `SocialPublishAttempt`: Tracks test post attempts and their results
  - Fields: id, userId, platform, kind ("test"), status ("success" | "failed"), providerPostId, providerPermalink, errorMessage, createdAt
  - Indexes on userId, platform, and createdAt for efficient queries

**Updated:**
- `User` model now includes relation to `SocialPublishAttempt`

### 2. API Route

#### POST `/api/social-connections/meta/test-post`
- Requires authentication and premium access
- Accepts optional `platforms` array in request body (defaults to all connected platforms)
- Reads selected destinations from `SocialPostingDestination`
- Reads access tokens from `SocialAccountConnection`
- Publishes test post to Facebook Page (if connected)
- Publishes test post to Instagram (if connected and available)
- Logs each attempt to `SocialPublishAttempt` table
- Returns per-platform results with post IDs and permalinks
- **Never returns tokens**

**Test Post Content:**
- Caption: "OBD Social Auto-Poster test post ✅ (timestamp)"
- Image: Uses `/obd-logo.png` from public directory (stable OBD-hosted asset)

### 3. Facebook Posting Logic

1. Fetches Facebook connection using selected destination account ID
2. Uses page access token (stored during OAuth)
3. Posts to page feed using Graph API `/feed` endpoint
4. Text-only post for reliability
5. Fetches permalink after successful post
6. Logs success or failure with appropriate details

### 4. Instagram Posting Logic

1. Fetches Instagram connection using selected destination account ID
2. Uses stored access token (page token works for IG Business accounts)
3. **Step 1**: Creates media container with image URL and caption
4. **Step 2**: Publishes the container
5. Fetches permalink from published media object
6. Handles common errors gracefully:
   - Permission errors: "Missing permissions or account not linked to Page"
   - Account type errors: "Instagram account not Business/Creator or not linked to Page"
7. Logs success or failure with appropriate details
8. **Important**: Instagram failure does NOT mark Facebook as failed

### 5. UI Updates

**Setup Page (`/apps/social-auto-poster/setup`):**
- Added "Send Test Post" button in Connect Accounts section
- Button states:
  - Disabled if Facebook not connected
  - Shows loading spinner while posting
- Results display:
  - Shows per-platform results with ✅/❌ indicators
  - Displays permalink as "View Post" link if available
  - Shows error message if post failed
  - Results persist until next test post or page refresh

### 6. Logging & Activity

- Each platform attempt creates a `SocialPublishAttempt` record
- Success records include:
  - providerPostId (post ID from Meta)
  - providerPermalink (permalink URL)
- Failure records include:
  - errorMessage (safe, user-readable error text, max 500 chars)
- Tokens and raw API responses are NEVER stored
- All records include userId, platform, kind="test", status, and timestamp

## Security Features

1. **Token Security**: Access tokens read from database but never logged or returned
2. **Error Handling**: Safe error messages only, no sensitive data exposed
3. **User Isolation**: All operations scoped to session userId
4. **No Token Exposure**: API responses never include tokens or raw provider responses

## Error Handling

### Facebook Errors:
- Connection not found
- Graph API errors (rate limits, permissions, etc.)
- Network errors

### Instagram Errors:
- Connection not found
- Media container creation failures
- Publishing failures
- Permission/account type errors (user-friendly messages)
- Network errors

**All errors are caught and logged without breaking the overall flow.**

## Migration Required

**Before running the application:**

1. Run Prisma migration:
   ```bash
   npx prisma migrate dev --name add_social_publish_attempt
   ```

2. Regenerate Prisma client:
   ```bash
   npx prisma generate
   ```

## Manual Test Checklist

- [ ] Connect Meta accounts (Facebook required, Instagram optional)
- [ ] Click "Send Test Post" button
- [ ] Verify button shows loading state
- [ ] Verify test post appears on Facebook Page
- [ ] If Instagram connected, verify test post appears on Instagram
- [ ] Verify results show ✅ with "View Post" links
- [ ] Click "View Post" links to verify they work
- [ ] Verify Activity/Logs show attempt records
- [ ] Test error scenarios (disconnect, invalid token, etc.)
- [ ] Verify Instagram failure doesn't affect Facebook result

## Files Changed

### New Files:
- `src/app/api/social-connections/meta/test-post/route.ts`

### Modified Files:
- `prisma/schema.prisma` - Added `SocialPublishAttempt` model
- `src/app/apps/social-auto-poster/setup/page.tsx` - Added test post UI

## Testing Notes

### Test Post Content:
- Uses OBD logo from `/obd-logo.png`
- Ensure this file exists in the `public/` directory
- Image must be accessible via public URL

### Instagram Requirements:
- Instagram account must be Business or Creator type
- Instagram account must be linked to the Facebook Page
- Required permissions: `instagram_content_publish`, `pages_manage_posts`

### Facebook Requirements:
- User must have admin/editor access to the Page
- Required permissions: `pages_manage_posts`

## Next Steps

- Add support for custom test post content
- Add preview of test post before sending
- Add retry logic for failed posts
- Add bulk test posting for multiple platforms
- Integrate test post results into activity dashboard

