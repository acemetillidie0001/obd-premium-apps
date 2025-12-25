# Meta (Facebook/Instagram) Connection Implementation - Phase 2A1

## Summary

This implementation adds Facebook and Instagram OAuth connection functionality to the Social Auto-Poster setup page. Users can connect their Meta accounts, which will be stored securely for future posting operations.

## Changes Made

### 1. Database Schema (Prisma)

**New Models:**
- `SocialAccountConnection`: Stores OAuth connections for social platforms
  - Fields: id, userId, platform, providerAccountId, displayName, accessToken, tokenExpiresAt, refreshToken, metaJson
  - Unique constraint: (userId, platform, providerAccountId)
  
- `SocialPostingDestination`: Stores selected posting destinations
  - Fields: id, userId, platform, selectedAccountId, selectedDisplayName
  - Unique constraint: (userId, platform)

**New Enum:**
- `SocialConnectionPlatform`: facebook | instagram | google_business | x

**Updated:**
- `User` model now includes relations to `SocialAccountConnection` and `SocialPostingDestination`

### 2. API Routes

#### GET `/api/social-connections/meta/status`
- Returns connection status for Facebook and Instagram
- Never returns tokens
- Shows configured status, connection status, and availability

#### POST `/api/social-connections/meta/connect`
- Initiates Meta OAuth flow
- Generates CSRF state token
- Returns authorization URL
- Stores state in signed cookie

#### GET `/api/social-connections/meta/callback`
- Handles OAuth callback
- Validates CSRF state
- Exchanges code for access token
- Fetches user's Facebook pages
- Selects first eligible page
- Stores Facebook connection
- Discovers and stores Instagram connection if available
- Redirects back to setup page

#### POST `/api/social-connections/meta/disconnect`
- Deletes all Meta connections (Facebook and Instagram)
- Deletes destination selections

### 3. UI Updates

**Setup Page (`/apps/social-auto-poster/setup`):**
- Added "Connect Accounts" section at the top
- Shows Facebook connection status with page name
- Shows Instagram connection status with username or "Not available" reason
- Buttons: Connect, Disconnect, Refresh Status
- Handles callback success/error messages
- Premium gating maintained

### 4. Environment Variables

Required environment variables:
- `META_APP_ID`: Meta App ID
- `META_APP_SECRET`: Meta App Secret
- `NEXT_PUBLIC_APP_URL`: Base URL for callback (already exists)

## Security Features

1. **CSRF Protection**: State token stored in signed cookie, validated on callback
2. **Token Security**: Access tokens stored in database, never logged
3. **User Isolation**: All database operations scoped to session userId
4. **No Token Exposure**: API responses never include tokens

## OAuth Scopes

Minimal scopes requested:
- `pages_show_list`: List pages user manages
- `pages_read_engagement`: Read page info
- `pages_manage_posts`: Publish to pages
- `instagram_basic`: Basic Instagram access
- `instagram_content_publish`: Publish to Instagram
- `business_management`: Access to IG business accounts

## Instagram Discovery Logic

1. After Facebook connection succeeds, attempts to discover Instagram business account
2. Queries selected Facebook page for linked `instagram_business_account`
3. If found, fetches IG account details (username, profile picture)
4. Stores Instagram connection if available
5. **Important**: Facebook connection succeeds even if Instagram is not available

## Migration Required

**Before running the application:**

1. Run Prisma migration:
   ```bash
   npx prisma migrate dev --name add_social_connections
   ```

2. Regenerate Prisma client:
   ```bash
   npx prisma generate
   ```

## Manual Test Checklist

- [ ] Connect flow succeeds and returns to setup
- [ ] Setup shows "Facebook Connected ✅" with Page name
- [ ] Instagram shows "Connected ✅" OR "Not available" with reason
- [ ] Refresh Status button works
- [ ] Disconnect clears state
- [ ] Error states display correctly (not configured, OAuth errors)
- [ ] Premium gating works (non-premium users see 403)

## Files Changed

### New Files:
- `src/app/api/social-connections/meta/status/route.ts`
- `src/app/api/social-connections/meta/connect/route.ts`
- `src/app/api/social-connections/meta/callback/route.ts`
- `src/app/api/social-connections/meta/disconnect/route.ts`

### Modified Files:
- `prisma/schema.prisma` - Added new models and enum
- `src/app/apps/social-auto-poster/setup/page.tsx` - Added Connect Accounts UI

## Next Steps (Phase 2A2+)

- Add actual posting pipeline using stored connections
- Add token refresh logic
- Add connection health checks
- Add support for multiple page selection
- Add Google Business and X (Twitter) connections

