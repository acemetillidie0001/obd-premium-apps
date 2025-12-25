# Real Publishing Implementation - Phase 2A1 Prompt #3

## Summary

This implementation enables real publishing for scheduled posts to Facebook Pages and Instagram Business accounts. The system automatically publishes posts when their scheduled time arrives, with retry logic and activity tracking.

## Changes Made

### 1. Database Schema Updates

**Modified Model: `SocialQueueItem`**
- Added `nextAttemptAt` (DateTime nullable) - for retry scheduling
- Added `lastErrorCode` (String nullable) - stores error code from provider
- Added indexes on `nextAttemptAt` and `userId, nextAttemptAt` for efficient querying

**Existing fields used:**
- `attemptCount` - tracks retry attempts
- `errorMessage` - stores last error message
- `metadata` (Json) - stores `lastProviderPostIds` with post IDs and permalinks
- `status` (QueueStatus) - tracks queued/scheduled/posted/failed status

### 2. Publishing Service

**New File: `src/lib/apps/social-auto-poster/publishers/metaPublisher.ts`**

Exports:
- `publishToFacebookPage()` - Publishes to Facebook Page feed (supports text + image)
- `publishToInstagram()` - Publishes to Instagram Business account (requires image)
- `isTemporaryError()` - Classifies errors as temporary (retry) vs permanent (fail)

**Features:**
- Never logs tokens or raw API responses
- Returns structured results with post IDs and permalinks
- Handles image uploads for Facebook
- Uses 2-step Instagram publishing (container creation + publish)
- User-friendly error messages for common scenarios

### 3. Post Processing Module

**New File: `src/lib/apps/social-auto-poster/processScheduledPost.ts`**

**Function: `processScheduledPost()`**
- Processes a single scheduled queue item
- Uses optimistic locking (updateMany with status check) to prevent concurrent processing
- Checks for Meta connections and uses real publishing if available
- Falls back to simulation if no connections
- Implements retry logic with exponential backoff
- Creates delivery attempt records for activity tracking

**Retry Strategy:**
- Max attempts: 5
- Backoff schedule: 2min, 5min, 15min, 60min
- Temporary errors: rate limits, network issues, temporary unavailability → retry
- Permanent errors: permission revoked, invalid token, missing connection → fail immediately

### 4. Updated Simulate-Run Endpoint

**Modified: `src/app/api/social-auto-poster/queue/simulate-run/route.ts`**

- Now uses `processScheduledPost()` for all items
- Automatically uses real publishing when Meta connections exist
- Falls back to simulation for non-Meta platforms or missing connections
- Maintains backward compatibility

### 5. Background Runner

**New File: `src/app/api/social-auto-poster/runner/route.ts`**

**Endpoints:**
- POST `/api/social-auto-poster/runner`
- GET `/api/social-auto-poster/runner` (same functionality)

**Features:**
- Protected by `CRON_SECRET` env var (check header `x-cron-secret` or query param `secret`)
- Finds due posts: `status=scheduled`, `scheduledAt <= now`, `nextAttemptAt <= now or null`
- Processes up to 50 items per run (batch limit)
- Returns processing statistics

**Vercel Cron Configuration:**
- Added to `vercel.json`: runs every minute (`* * * * *`)
- Configured at path: `/api/social-auto-poster/runner`

### 6. UI Updates

**Modified: `src/app/apps/social-auto-poster/activity/page.tsx`**
- Shows provider post links ("View Post →") when available
- Links extracted from `responseData.providerPermalink` in delivery attempts
- Maintains existing status display (posted ✅ / failed ❌)

**Queue Page:**
- Already displays status and error messages (no changes needed)
- Shows queued/scheduled/posted/failed status
- Displays error messages for failed posts

**Modified: `src/app/api/social-auto-poster/activity/route.ts`**
- Includes `metadata` field in response for future use

### 7. Security

- Runner endpoint protected by `CRON_SECRET`
- Tokens never logged or exposed in API responses
- Raw provider responses not stored in database
- Only safe error messages stored

## Migration Required

**Before running the application:**

1. Run Prisma migration:
   ```bash
   npx prisma migrate dev --name add_retry_fields_to_queue
   ```

2. Regenerate Prisma client:
   ```bash
   npx prisma generate
   ```

## Environment Variables

**Required:**
- `CRON_SECRET` - Secret for protecting runner endpoint (generate a random string)
- `META_APP_ID` - Meta App ID (already exists)
- `META_APP_SECRET` - Meta App Secret (already exists)
- `NEXT_PUBLIC_APP_URL` - Base URL for callbacks (already exists)

**To set CRON_SECRET:**
```bash
# Generate a random secret (example)
openssl rand -hex 32
# Or use any secure random string
```

Set in:
- `.env.local` for local development
- Vercel Project Settings → Environment Variables for production

**For detailed environment variable setup and cron runner documentation, see:**
- [`docs/apps/social-auto-poster-cron-runner.md`](./docs/apps/social-auto-poster-cron-runner.md)
- [`docs/VERCEL_ENV_VARS.md`](./docs/VERCEL_ENV_VARS.md)

## Manual Testing

### Test Runner Manually:

```bash
# Using query parameter (recommended for Vercel Cron)
curl -X POST "https://your-domain.com/api/social-auto-poster/runner?secret=YOUR_CRON_SECRET"

# Using header (for manual testing)
curl -X POST "https://your-domain.com/api/social-auto-poster/runner" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

**Local testing:**
```bash
curl -X POST "http://localhost:3000/api/social-auto-poster/runner?secret=YOUR_LOCAL_CRON_SECRET"
```

### Verification Steps:

1. **Connect Meta Accounts:**
   - Go to `/apps/social-auto-poster/setup`
   - Click "Connect Facebook/Instagram"
   - Complete OAuth flow
   - Verify connection status shows ✅

2. **Create Scheduled Post:**
   - Go to `/apps/social-auto-poster/composer` (or queue)
   - Create a post for Facebook or Instagram
   - Schedule it for 2 minutes in the future
   - Status should show "scheduled"

3. **Trigger Runner:**
   - Wait until scheduled time, OR
   - Manually trigger runner with curl command above
   - Check runner response for `processed`, `succeeded`, `failed` counts

4. **Verify Post Published:**
   - Check Facebook Page or Instagram account
   - Post should appear live
   - Verify content matches what was scheduled

5. **Check Activity Log:**
   - Go to `/apps/social-auto-poster/activity`
   - Find the post in activity log
   - Status should show "posted" ✅
   - Should have "View Post →" link if permalink available
   - Click link to verify it opens the published post

6. **Check Queue:**
   - Go to `/apps/social-auto-poster/queue`
   - Post status should show "posted"
   - If failed, error message should be displayed

7. **Test Retry Logic:**
   - Disconnect Meta accounts (or revoke token)
   - Create a new scheduled post
   - Trigger runner
   - Post should show "failed" after max attempts
   - Check that retries happened (attemptCount increments)

## Files Changed

### New Files:
- `src/lib/apps/social-auto-poster/publishers/metaPublisher.ts`
- `src/lib/apps/social-auto-poster/processScheduledPost.ts`
- `src/app/api/social-auto-poster/runner/route.ts`

### Modified Files:
- `prisma/schema.prisma` - Added `nextAttemptAt` and `lastErrorCode` fields
- `src/app/api/social-auto-poster/queue/simulate-run/route.ts` - Uses real publishing
- `src/app/api/social-auto-poster/activity/route.ts` - Includes metadata
- `src/app/apps/social-auto-poster/activity/page.tsx` - Shows provider links
- `vercel.json` - Added cron job for runner

## Behavior Notes

### Platform Handling:
- Each queue item has a single `platform` field (facebook or instagram)
- Facebook queue items → publish to Facebook Page only
- Instagram queue items → publish to Instagram Business account only
- No cross-posting (each platform gets its own queue item)

### Publishing Flow:
1. Runner finds due posts (status=scheduled, scheduledAt <= now, nextAttemptAt <= now or null)
2. For each post:
   - Mark as processing (optimistic lock)
   - Check for Meta connection
   - If connected → publish via Meta API
   - If not connected → simulate (fallback)
   - Update status (posted/failed/scheduled for retry)
   - Create delivery attempt record

### Retry Logic:
- Attempts 1-4: Temporary errors → schedule retry with exponential backoff
- Attempt 5: Any error → mark as failed (permanent)
- Permanent errors (permission, invalid token) → fail immediately regardless of attempt count

### Activity Tracking:
- Every publish attempt creates a `SocialDeliveryAttempt` record
- Success records include: `providerPostId`, `providerPermalink`
- Failure records include: `errorMessage`, `errorCode` (if available)
- Links appear in Activity page when permalinks are available

## Next Steps (Future Enhancements)

- Add support for X (Twitter) publishing
- Add support for Google Business Profile publishing
- Add manual "Publish Now" button for immediate publishing
- Add bulk retry for failed posts
- Add email notifications for failed posts
- Add analytics dashboard for posting performance

