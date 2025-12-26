# Social Auto-Poster: Google Business Profile Integration

This document explains how to set up and use Google Business Profile (GBP) integration for the Social Auto-Poster.

## Overview

Google Business Profile integration allows you to:
- Connect your Google account with Business Profile access
- Select which business location to post to
- Send test posts to verify publishing works
- Automatically publish scheduled posts to your selected location

## Prerequisites

- Premium user account
- Google Business Profile account with at least one verified location
- Google Cloud Console project with OAuth 2.0 credentials

## Google Cloud Console Setup

### 1. Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Configure OAuth consent screen (if not already done):
   - User Type: **External** (for most cases)
   - App name: "OBD Premium Apps"
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue**
6. Add scopes:
   - `https://www.googleapis.com/auth/business.manage`
   - `https://www.googleapis.com/auth/plus.business.manage`
   - Click **Save and Continue**
7. Add test users (if app is in testing):
   - Add your Google account email
   - Click **Save and Continue**
8. Create OAuth client ID:
   - Application type: **Web application**
   - Name: "OBD Social Auto-Poster"
   - Authorized redirect URIs:
     - Local: `http://localhost:3000/api/social-connections/google/callback`
     - Production: `https://apps.ocalabusinessdirectory.com/api/social-connections/google/callback`
   - Click **Create**
9. Copy the **Client ID** and **Client Secret**

### 2. Required Scopes

The following OAuth scopes are required:

- `https://www.googleapis.com/auth/business.manage` - Manage Google Business Profile
- `https://www.googleapis.com/auth/plus.business.manage` - Business management (legacy, may be required)

### 3. Authorized Redirect URIs

Add these exact URIs to your OAuth client:

**Local Development:**
```
http://localhost:3000/api/social-connections/google/callback
```

**Production:**
```
https://apps.ocalabusinessdirectory.com/api/social-connections/google/callback
```

**Important:**
- Must match exactly (including protocol and path)
- No trailing slashes
- Case-sensitive

## Environment Variables

Set these in Vercel Project Settings → Environment Variables (Production):

- `GOOGLE_CLIENT_ID` - OAuth 2.0 Client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - OAuth 2.0 Client Secret from Google Cloud Console
- `GOOGLE_REDIRECT_URI` - (Optional) Override redirect URI (defaults to `${NEXT_PUBLIC_APP_URL}/api/social-connections/google/callback`)
- `NEXT_PUBLIC_APP_URL` - Must be set (used for redirect URI if `GOOGLE_REDIRECT_URI` not set)

**Local Development (`.env.local`):**
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## How to Connect

### Step 1: Open Setup Page

1. Navigate to `/apps/social-auto-poster/setup`
2. Scroll to "Connect Accounts" section
3. Find "Google Business Profile" row

### Step 2: Connect Google Account

1. Click **"Connect Google Business Profile"** button
2. You'll be redirected to Google OAuth consent screen
3. Review requested permissions:
   - Manage your Google Business Profile
   - Access your business information
4. Click **"Allow"** or **"Continue"**
5. You'll be redirected back to Setup page
6. **Expected:** Success banner appears, status shows "Connected ✅"

### Step 3: Select Location (if multiple)

If you have multiple business locations:

1. A dropdown will appear showing all available locations
2. Select the location you want to post to
3. Status will update to show selected location name

### Step 4: Send Test Post

1. Click **"Send GBP Test Post"** button
2. **Expected:** Button shows "Sending..." while processing
3. **Expected:** Test post results appear below
4. **Expected:** Shows ✅ with "View Post →" link if successful
5. Click "View Post →" to verify post appears on Google Business Profile

## API Endpoints

### GET /api/social-connections/google/status

Returns connection status and available locations.

**Response (Success):**
```json
{
  "ok": true,
  "configured": true,
  "connected": true,
  "location": {
    "id": "location-id",
    "name": "Business Name"
  },
  "locations": [
    { "id": "location-1", "name": "Location 1" },
    { "id": "location-2", "name": "Location 2" }
  ],
  "account": {
    "displayName": "user@example.com",
    "providerAccountId": "google-account-id"
  }
}
```

**Response (Not Configured):**
```json
{
  "ok": false,
  "configured": false,
  "configuredReason": "missing GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
  "errorCode": "GOOGLE_NOT_CONFIGURED",
  "connected": false
}
```

### POST /api/social-connections/google/connect

Initiates OAuth flow. Returns OAuth URL.

**Response:**
```json
{
  "ok": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### GET /api/social-connections/google/callback

Handles OAuth callback. Exchanges code for tokens, fetches locations, stores connection.

**Redirects to:** `/apps/social-auto-poster/setup?google_connected=1` (success) or `?error=<code>` (failure)

### POST /api/social-connections/google/disconnect

Disconnects Google Business Profile connection.

**Response:**
```json
{
  "ok": true
}
```

### POST /api/social-connections/google/select-location

Updates selected location.

**Request Body:**
```json
{
  "locationId": "location-id"
}
```

**Response:**
```json
{
  "ok": true
}
```

### POST /api/social-connections/google/test-post

Publishes a test post to selected location.

**Response:**
```json
{
  "ok": true,
  "result": {
    "postId": "post-id",
    "permalink": "https://www.google.com/maps/place/?q=place_id:...",
    "error": null
  }
}
```

## Scheduled Publishing

When a scheduled post targets `google_business` platform:

1. Runner finds due queue items
2. Checks for Google Business Profile connection
3. Publishes to selected location using `publishToGoogleBusiness`
4. Stores `providerPostId` and `providerPermalink` in metadata
5. Logs delivery attempt to Activity page
6. Retries on temporary errors (rate limits, network issues)
7. Marks as failed on permanent errors (permissions, invalid location)

**Token Refresh:**
- If access token expires, automatically refreshes using refresh token
- Updates database with new token and expiration
- Retries the publish operation once

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Google Business Profile connection not configured" | Missing `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` | Add env vars in Vercel Project Settings |
| "Redirect URI mismatch" | OAuth redirect URI not in Google Cloud Console | Add exact URI to OAuth client settings |
| "No business locations found" | Account has no verified locations | Add and verify a location in Google Business Profile |
| "Token expired" | Access token expired and refresh failed | Disconnect and reconnect |
| "Missing required permissions" | User denied permissions during OAuth | Disconnect and reconnect, approve all permissions |
| "Business location not verified" | Location not verified in Google Business Profile | Verify location in Google Business Profile dashboard |
| "Rate limit exceeded" | Too many API requests | Wait a few minutes and try again |
| Test post fails with generic error | Check API error in response | Use error mapper to show user-friendly message |

## Common Error Codes

- `GOOGLE_NOT_CONFIGURED` - Missing environment variables
- `TOKEN_EXPIRED` - Access token expired (will auto-refresh if refresh token available)
- `NO_LOCATIONS` - No business locations found
- `NO_ACCOUNTS` - No Google Business accounts found
- `INSUFFICIENT_SCOPES` - Missing required OAuth permissions
- `RATE_LIMITED` - Too many API requests (temporary)
- `NOT_VERIFIED` - Business location not verified

## Security Notes

- **Never log tokens** - Access tokens and refresh tokens are never logged
- **Never return tokens** - API endpoints never return tokens in responses
- **CSRF protection** - OAuth flow uses signed JWT state tokens
- **Token refresh** - Automatically refreshes expired tokens using refresh token
- **Secure storage** - Tokens stored in database with proper access controls

## Related Documentation

- [`social-auto-poster-prod-verification.md`](./social-auto-poster-prod-verification.md) - Production verification checklist
- [`social-auto-poster-env-checklist.md`](./social-auto-poster-env-checklist.md) - Environment variable checklist
- [`social-auto-poster-meta-qa.md`](./social-auto-poster-meta-qa.md) - Meta connection QA guide

