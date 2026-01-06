# Social Auto-Poster App - Implementation Map

**Generated:** 2024  
**Purpose:** Technical audit and component mapping for the Social Auto-Poster application

---

## 1. Component Tree

### Main Page Entry
- **`src/app/apps/social-auto-poster/page.tsx`** (Dashboard)
  - `OBDPageContainer` (layout wrapper)
  - `SocialAutoPosterNav` (navigation)
  - Analytics Panel
  - Quick Actions Panel
  - Getting Started Panel

### Sub-Pages

#### Setup Page
- **`src/app/apps/social-auto-poster/setup/page.tsx`**
  - `OBDPageContainer`
  - `SocialAutoPosterNav`
  - `OBDPanel` (settings form)
  - `OBDHeading`
  - Connection Status UI (Meta & Google)
  - Settings Form (brand voice, posting mode, scheduling, platforms, content pillars, hashtags, images)
  - Test Post UI

#### Composer Page
- **`src/app/apps/social-auto-poster/composer/page.tsx`**
  - `OBDPageContainer`
  - `SocialAutoPosterNav`
  - `CrmIntegrationIndicator` (CRM integration)
  - `OBDToast` (notifications)
  - Post Generation Form
  - Preview Panels (per platform)
  - Variant Selection UI

#### Queue Page
- **`src/app/apps/social-auto-poster/queue/page.tsx`**
  - `OBDPageContainer`
  - `SocialAutoPosterNav`
  - `OBDFilterBar` (status filters)
  - `SocialQueueCalendar` (calendar view)
  - Queue Item List (list view)
  - Item Detail Drawer/Modal
  - Image Status Badges
  - Image Regeneration UI

#### Activity Page
- **`src/app/apps/social-auto-poster/activity/page.tsx`**
  - `OBDPageContainer`
  - `SocialAutoPosterNav`
  - Activity Log List
  - Delivery Attempt Details (expandable)

### Shared Components
- **`src/components/obd/SocialAutoPosterNav.tsx`** - Navigation bar
- **`src/components/obd/SocialQueueCalendar.tsx`** - Calendar view for scheduled posts
- **`src/components/obd/OBDPageContainer.tsx`** - Page layout wrapper
- **`src/components/obd/OBDPanel.tsx`** - Content panel
- **`src/components/obd/OBDHeading.tsx`** - Heading component
- **`src/components/obd/OBDFilterBar.tsx`** - Filter bar
- **`src/components/obd/OBDToast.tsx`** - Toast notifications
- **`src/components/crm/CrmIntegrationIndicator.tsx`** - CRM integration UI

---

## 2. Key Files

### Frontend Pages
- `src/app/apps/social-auto-poster/page.tsx` - Dashboard (main entry)
- `src/app/apps/social-auto-poster/setup/page.tsx` - Setup/Settings page
- `src/app/apps/social-auto-poster/composer/page.tsx` - Post composer
- `src/app/apps/social-auto-poster/queue/page.tsx` - Queue management
- `src/app/apps/social-auto-poster/activity/page.tsx` - Activity logs/history

### API Routes

#### Settings
- `src/app/api/social-auto-poster/settings/route.ts` - Get/save settings

#### Connection Status
- `src/app/api/social-connections/meta/status/route.ts` - Meta (Facebook/Instagram) connection status
- `src/app/api/social-connections/google/status/route.ts` - Google Business Profile connection status

#### Post Generation
- `src/app/api/social-auto-poster/generate/route.ts` - Generate posts via AI

#### Queue Management
- `src/app/api/social-auto-poster/queue/route.ts` - List queue items
- `src/app/api/social-auto-poster/queue/create/route.ts` - Create queue item
- `src/app/api/social-auto-poster/queue/approve/route.ts` - Approve/schedule queue item
- `src/app/api/social-auto-poster/queue/image/route.ts` - Get image info for queue item
- `src/app/api/social-auto-poster/queue/image/regenerate/route.ts` - Regenerate image
- `src/app/api/social-auto-poster/queue/simulate-run/route.ts` - Simulate post run

#### Publishing
- `src/app/api/social-auto-poster/runner/route.ts` - Post runner (processes scheduled posts)
- `src/app/api/social-auto-poster/cron/route.ts` - Cron endpoint for scheduled execution

#### Activity & Analytics
- `src/app/api/social-auto-poster/activity/route.ts` - Get activity logs
- `src/app/api/social-auto-poster/analytics/route.ts` - Get analytics summary

### Library Files
- `src/lib/apps/social-auto-poster/types.ts` - TypeScript type definitions
- `src/lib/apps/social-auto-poster/metaConnectionStatus.ts` - Meta connection status helper
- `src/lib/apps/social-auto-poster/metaErrorMapper.ts` - Meta error mapping
- `src/lib/apps/social-auto-poster/handoff-parser.ts` - Handoff payload parser
- `src/lib/apps/social-auto-poster/publishers/metaPublisher.ts` - Meta publisher
- `src/lib/apps/social-auto-poster/publishers/googleBusinessPublisher.ts` - Google Business publisher
- `src/lib/apps/social-auto-poster/processScheduledPost.ts` - Process scheduled post
- `src/lib/apps/social-auto-poster/runDuePosts.ts` - Run due posts
- `src/lib/apps/social-auto-poster/resolvePostImage.ts` - Resolve post image
- `src/lib/apps/social-auto-poster/imageEngineClient.ts` - Image engine client
- `src/lib/apps/social-auto-poster/imageRequestBuilder.ts` - Image request builder
- `src/lib/apps/social-auto-poster/imageConcurrencyLimiter.ts` - Image concurrency limiter
- `src/lib/apps/social-auto-poster/imagePlatformMap.ts` - Image platform mapping
- `src/lib/apps/social-auto-poster/imageCategoryMap.ts` - Image category mapping
- `src/lib/apps/social-auto-poster/aiSchema.ts` - AI schema definitions
- `src/lib/apps/social-auto-poster/utils.ts` - Utility functions
- `src/lib/apps/social-auto-poster/getBaseUrl.ts` - Base URL helper
- `src/lib/apps/social-auto-poster/vercelCronVerification.ts` - Vercel cron verification

---

## 3. Data Models & Types

### Core Types (from `src/lib/apps/social-auto-poster/types.ts`)

#### Enums
- `SocialPlatform`: `"facebook" | "instagram" | "x" | "googleBusiness"`
- `PostingMode`: `"review" | "auto" | "campaign"`
- `QueueStatus`: `"draft" | "approved" | "scheduled" | "posted" | "failed"`
- `ContentTheme`: `"education" | "promotion" | "social_proof" | "community" | "seasonal" | "general"`
- `ContentPillar`: `"education" | "promotion" | "social_proof" | "community" | "seasonal"`

#### Settings Types
- `SocialAutoposterSettings` - Main settings object
  - `brandVoice?: string`
  - `postingMode: PostingMode`
  - `schedulingRules: SchedulingRules`
  - `enabledPlatforms: SocialPlatform[]`
  - `platformOverrides?: PlatformOverridesMap`
  - `contentPillarSettings?: ContentPillarSettings`
  - `hashtagBankSettings?: HashtagBankSettings`
  - `imageSettings?: ImageSettings`

#### Post Generation Types
- `GeneratePostsRequest` - Request for post generation
- `GeneratePostsResponse` - Response with previews and variants
- `SocialPostPreview` - Post preview with character counts
- `SocialPostDraft` - Draft post with metadata
- `PostImage` - Image metadata (status, URL, alt text, etc.)

#### Queue Types
- `SocialQueueItem` - Queue item with status, scheduling, content
- `CreateQueueItemRequest` - Request to create queue item
- `UpdateQueueItemRequest` - Request to update queue item
- `QueueListResponse` - List of queue items

#### Activity Types
- `ActivityLogItem` - Activity log entry
- `SocialDeliveryAttempt` - Delivery attempt record
- `ActivityListResponse` - List of activity items

#### Analytics Types
- `AnalyticsSummary` - Analytics summary with metrics

---

## 4. Error Message Locations

### "Unable to load connection status" Error

The error message **"Unable to load connection status"** appears in the following locations:

1. **`src/lib/apps/social-auto-poster/metaConnectionStatus.ts`**
   - Line 74: `message: "Unable to load connection status. Please try again later."`
   - Line 82: `message: apiResponse.errorMessage || "Unable to load connection status."`

2. **`src/app/api/social-connections/meta/status/route.ts`**
   - Line 192: `errorMessage: "Unable to load connection status. Please refresh or try again."`

3. **`src/app/api/social-connections/google/status/route.ts`**
   - Line 164: `errorMessage: "Unable to load connection status. Please refresh or try again."`

4. **`src/app/apps/social-auto-poster/setup/page.tsx`**
   - Line 942: `googleStatus.errorMessage || "Unable to load connection status. Please refresh or try again."`
   - Line 1404: `connectionStatus.errorMessage || "Unable to load connection status. Please refresh or try again."`
   - Line 1415: `"Unable to load connection status. Please refresh or try again."`

---

## 5. Component Responsibilities

### Setup Page (`setup/page.tsx`)
- **Connection Status**: Displays Meta (Facebook/Instagram) and Google Business Profile connection status
- **Settings Form**: Brand voice, posting mode, scheduling rules, platform selection, content pillars, hashtags, images
- **Test Posts**: Ability to test post to connected platforms

### Composer Page (`composer/page.tsx`)
- **Post Generation**: Form to generate posts via AI
- **Platform Selection**: Multi-platform post generation
- **Preview**: Shows generated posts with character counts and validation
- **Variants**: Generate and select variants per platform
- **Queue Integration**: Add generated posts to queue
- **Handoff Support**: Import captions from Image Caption Generator
- **CRM Integration**: Prefill from CRM context

### Queue Page (`queue/page.tsx`)
- **Queue Management**: List and filter queue items by status
- **Calendar View**: Visual calendar of scheduled posts
- **Status Management**: Approve, schedule, pause, skip posts
- **Image Management**: Display image status, regenerate images
- **Item Details**: Drawer/modal for detailed view

### Activity Page (`activity/page.tsx`)
- **Activity Logs**: History of posted/failed posts
- **Delivery Attempts**: Expandable details of each delivery attempt
- **Error Tracking**: Error messages and retry information

### Dashboard Page (`page.tsx`)
- **Analytics**: Summary metrics (scheduled, posted, success rate, platform distribution)
- **Quick Actions**: Links to Setup, Composer, Queue, Activity
- **Getting Started**: Onboarding guidance

---

## 6. API Endpoint Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/social-auto-poster/settings` | GET, POST | Get/save settings |
| `/api/social-auto-poster/generate` | POST | Generate posts |
| `/api/social-auto-poster/queue` | GET | List queue items |
| `/api/social-auto-poster/queue/create` | POST | Create queue item |
| `/api/social-auto-poster/queue/approve` | POST | Approve/schedule item |
| `/api/social-auto-poster/queue/image` | GET | Get image info |
| `/api/social-auto-poster/queue/image/regenerate` | POST | Regenerate image |
| `/api/social-auto-poster/queue/simulate-run` | POST | Simulate post run |
| `/api/social-auto-poster/activity` | GET | Get activity logs |
| `/api/social-auto-poster/analytics` | GET | Get analytics |
| `/api/social-auto-poster/runner` | POST | Process scheduled posts |
| `/api/social-auto-poster/cron` | GET | Cron endpoint |
| `/api/social-connections/meta/status` | GET | Meta connection status |
| `/api/social-connections/google/status` | GET | Google connection status |

---

## 7. Key Features

- **Multi-Platform Support**: Facebook, Instagram, X (Twitter), Google Business Profile
- **AI Post Generation**: Platform-optimized content generation
- **Review Mode**: Manual approval workflow
- **Auto Mode**: Automatic scheduling and posting
- **Content Pillars**: Education, Promotion, Social Proof, Community, Seasonal
- **Image Generation**: AI-generated images for posts
- **Scheduling**: Flexible scheduling rules (frequency, time windows, days)
- **Analytics**: Success rates, platform distribution, activity tracking
- **CRM Integration**: Prefill from CRM context
- **Handoff Support**: Import from Image Caption Generator

---

## 8. Connection Status UI States (Tier 5A UX)

### Status Mapping

The app uses explicit connection states with calm, user-friendly messaging:

| State | Label | Message | Badge Color | Conditions |
|-------|-------|---------|-------------|------------|
| **Connected** | "Connected" | "Accounts connected and ready to publish." | Green | Meta publishing enabled AND connection OK AND pages access granted |
| **Limited Mode** | "Limited Mode" | "You can generate, approve, and queue posts. Publishing will activate automatically once approved." | Blue | Publishing not enabled via feature flag, but connection is OK |
| **API Pending** | "API Pending" | "Facebook & Instagram posting is temporarily unavailable while Meta completes app review." | Yellow | Publishing disabled due to app review |
| **Disabled** | "Disabled" | "Connect accounts to enable publishing." | Gray | Not connected (no connection) |
| **Error** | "Error" | "We couldn't verify connection status right now. Try again." | Red | Real error state (DB error, etc.) |

### Implementation Files

- **`src/lib/apps/social-auto-poster/connectionStatusUI.ts`** - Status mapping helper function
  - `getConnectionStatusUI()` - Maps API responses to UI states
  - Handles null/undefined safely
  - Provides explicit messaging for each state

- **`src/components/obd/ConnectionStatusBadge.tsx`** - Status badge component
  - Displays small pill/badge near page titles
  - Follows OBD Tier 5A UI patterns
  - Color-coded by state (green/blue/yellow/gray/red)

### Status Badge Display

The status badge appears on all Social Auto-Poster pages:
- Dashboard (`page.tsx`)
- Setup (`setup/page.tsx`)
- Composer (`composer/page.tsx`)
- Queue (`queue/page.tsx`)
- Activity (`activity/page.tsx`)

Badge is displayed:
- Near the page title (after navigation)
- With optional status message below
- Updates based on connection status API response

### Error Message Updates

All error messages have been replaced with calm, explicit messaging:
- ❌ "Unable to load connection status" → ✅ "We couldn't verify connection status right now. Try again."
- ❌ Red error styling → ✅ Neutral gray styling (unless real error state)
- ❌ Scary error messages → ✅ Clear, actionable status messages

### API Integration

Status is fetched from:
- `/api/social-connections/meta/status` - Meta (Facebook/Instagram) connection status
- `/api/social-connections/google/status` - Google Business Profile status (optional)

No backend changes required - uses existing API responses.

---

## 9. Tier 5B — Guided UX, Trust & Transparency

### Guided Setup

The Setup page implements guided setup with completion tracking:

- **Required Sections:**
  - Posting Mode (required)
  - Platforms (required)
  - Schedule (required)
- **Optional Sections:**
  - Brand & Content (optional)

**Setup Progress Indicator:**
- Shows "{x} of {y} required sections complete"
- Visual progress bar
- Sections show completion state (complete/incomplete)

**Implementation:**
- `src/lib/apps/social-auto-poster/setup/setupValidation.ts` - Completion logic
- `src/app/apps/social-auto-poster/setup/components/SetupProgress.tsx` - Progress indicator
- `src/app/apps/social-auto-poster/setup/components/SetupSection.tsx` - Section component with completion pill

### Sticky Save Bar

The Setup page includes a sticky save bar at the bottom:

- Appears at bottom of Setup page (fixed position)
- Shows "Unsaved changes" when dirty
- Disabled when validation fails
- Enabled when all required sections complete
- Helper text: "Complete required sections to save"

**Implementation:**
- `src/app/apps/social-auto-poster/setup/components/StickySaveBar.tsx` - Sticky save bar component
- Dirty detection via JSON string comparison of settings snapshot

### Composer Clarity Banner

The Composer page displays a clarity banner showing:

- Posting Mode (Review, Auto, or Campaign)
- Brand source (Brand Kit vs Local Overrides)
- Link to Setup page for editing

**Implementation:**
- `src/app/apps/social-auto-poster/composer/page.tsx` - Banner display (lines 1160-1208)
- Shows `settings.postingMode` and `settings.useBrandKit` state

### Activity Messages

The Activity page displays human-readable messages:

- Human-readable messages (not raw error codes)
- Next action labels (will_retry, paused, needs_attention)
- Retry policy info box
- Clear, actionable messaging

**Implementation:**
- `src/app/apps/social-auto-poster/activity/page.tsx` - Activity log display
- Message formatting for delivery attempts and errors

### First-Run Callouts

Session-dismissable callouts appear on key pages:

- Setup page: Connection states explanation
- Queue page: Blocked status explanation
- Composer page: Workflow explanation

**Implementation:**
- `src/app/apps/social-auto-poster/ui/SessionCallout.tsx` - Callout component
- Dismiss keys stored in sessionStorage
- Do not reappear in same session

### Deterministic Brand Source

The brand source flag (`useBrandKit`) provides deterministic behavior:

- Defaults to `true` for backward compatibility
- Persisted in `SocialAutoposterSettings.useBrandKit`
- Composer displays current state (Brand Kit vs Local Overrides)
- Settings page allows toggling between Brand Kit and local overrides

**Implementation:**
- `src/app/apps/social-auto-poster/setup/page.tsx` - Brand source toggle
- `src/app/apps/social-auto-poster/composer/page.tsx` - Brand source display
- `src/app/api/social-auto-poster/settings/route.ts` - Persistence with `?? true` default

---

## 10. Tier 5C Handoffs

### Overview

The Social Auto-Poster composer supports importing content from multiple source apps via a canonical handoff system. This enables seamless workflow integration between content creation apps and social posting.

### Source Apps

The following apps can send content to Social Auto-Poster:

1. **Offers Builder** → Social Auto-Poster (campaign import)
   - Sends structured offer details for campaign creation
   - Button: "Create Social Campaign" in Offers Builder
   - Payload: Campaign type (`offer`), headline, description, CTA, expiration date

2. **AI Content Writer** → Social Auto-Poster (text import)
   - Sends final edited content as plain text
   - Button: "Send to Social Auto-Poster" in Export Center
   - Payload: Simple text content (`text` field)

3. **Event Campaign Builder** → Social Auto-Poster (event import + variants)
   - Sends event details with countdown variants
   - Button: "Create Event Social Posts"
   - Payload: Event name, date, location, description, countdown variants array

4. **Image Caption Generator** (`image-caption-generator`)
   - Sends platform-specific captions
   - Payload: Array of captions with platform, hashtags, and goals

### Transport Mechanism

**SessionStorage Key:** `"obd:social-auto-poster:handoff"`

- Payload is stored as JSON string in `sessionStorage` using standardized transport helper
- Uses `writeHandoff()` from `src/lib/utils/handoffTransport.ts`
- Prevents URL length limitations
- Automatically cleared after import
- Session-scoped (cleared on browser close)

**TTL Behavior:**
- Default TTL: 10 minutes (600,000ms)
- Envelope structure: `{ v: 1, createdAt: ISO timestamp, ttlMs: number, payload: {...}, source: string }`
- Expired handoffs are automatically cleared on read
- TTL prevents stale payloads from being imported
- Expired handoffs return error and are not imported

**URL Trigger:** `/apps/social-auto-poster/composer?handoff=1`

- Simple query parameter indicates handoff intent
- Actual payload is read from sessionStorage (not from URL)
- URL param (`?handoff=1`) is removed after import via `clearHandoffParamsFromUrl()`
- Backward compatibility: Legacy URL payloads (if present) are migrated to sessionStorage

### Payload Structure

All handoffs use the canonical `SocialComposerHandoffPayload` type:

```typescript
{
  v: 1;                                    // Version (always 1)
  source: SocialHandoffSource;             // Source app identifier
  createdAt?: string;                      // ISO timestamp
  text?: string;                           // Plain text content (preferred)
  
  // Optional structured fields for offers
  campaignType?: "offer" | "event";
  headline?: string;
  description?: string;
  cta?: string;
  expirationDate?: string;
  
  // Optional structured fields for events
  eventName?: string;
  eventDate?: string;
  location?: string;
  countdownVariants?: string[];
  
  // Optional structured fields for image captions
  captions?: Array<{
    platform: string;
    caption: string;
    hashtags?: string[];
    goal?: string | null;
  }>;
}
```

### Import Process

1. **Parser** (`parseSocialHandoff.ts`)
   - Reads from sessionStorage (preferred) or URL param
   - Validates payload structure
   - Sanitizes text fields (trim, length limits)
   - Returns `{ payload }` or `{ error }`

2. **Composer Handler** (`composer/page.tsx`)
   - Runs after settings are loaded
   - Calls `parseSocialHandoff()` once
   - Shows import banner with source attribution
   - Prefills composer ONLY if editor is empty
   - Clears sessionStorage and URL param after import

3. **Import Banner**
   - Dismissible via `SessionCallout` component
   - Shows source app display name
   - For events: includes variant dropdown if `countdownVariants` exist
   - Non-blocking (user can dismiss and continue)

### Guardrails

**No Auto-Save:**
- Settings are never automatically saved
- Posting mode is never changed automatically (UI may suggest Campaign mode, but user must save)
- User must explicitly save any changes

**No Auto-Queue:**
- No queue entries are created automatically
- User must manually add posts to queue
- Import is draft-only

**Prefill Only If Empty:**
- Composer checks if `topic` and `details` are empty
- Only prefills if both are empty
- Never overwrites existing user content

**Clear After Import/Dismiss:**
- SessionStorage key (`"obd:social-auto-poster:handoff"`) is cleared immediately after import
- URL param (`?handoff=1`) is removed after import via `clearHandoffParamsFromUrl()`
- Dismissing the import banner also clears the payload
- Prevents duplicate imports on refresh

**Safe Variant Switching (Events Only):**
- For events with countdown variants, dropdown allows switching
- Only updates editor if content still matches original imported text snapshot
- If user has edited, variant switching silently does nothing
- Prevents accidental overwrite of user edits

**Tenant Safety:**
- All operations are user-scoped via session auth
- No cross-tenant data exposure
- Payload validation prevents malicious content

### Defense-in-Depth Hardening

Queue mutation operations include defense-in-depth tenant safety measures:

- Queue mutations are scoped by `userId` at both authorization and mutation layers
- Uses `updateMany` / `deleteMany` with ownership checks in where clauses
- Protects against race conditions and edge cases where ownership might change between check and mutation
- Returns 404 if mutation affects 0 rows (ownership mismatch or item not found)
- No schema or behavior changes for authorized users

See: `OBD_SOCIAL_AUTO_POSTER_DEFENSE_IN_DEPTH_SUMMARY.md`

### Handoff Flow Summary

1. **Offers Builder** → Social Auto-Poster:
   - User clicks "Create Social Campaign" in Offers Builder
   - Payload written to sessionStorage with TTL
   - Redirects to `/apps/social-auto-poster/composer?handoff=1`
   - Composer reads from sessionStorage, shows import banner
   - Prefills topic/details if empty (does not overwrite)
   - Clears payload and URL param after import/dismiss

2. **AI Content Writer** → Social Auto-Poster:
   - User clicks "Send to Social Auto-Poster" in Export Center
   - Final edited text written to sessionStorage with TTL
   - Redirects to `/apps/social-auto-poster/composer?handoff=1`
   - Composer reads from sessionStorage, shows import banner
   - Prefills topic/details if empty (does not overwrite)
   - Clears payload and URL param after import/dismiss

3. **Event Campaign Builder** → Social Auto-Poster:
   - User clicks "Create Event Social Posts"
   - Event details + countdown variants written to sessionStorage with TTL
   - Redirects to `/apps/social-auto-poster/composer?handoff=1`
   - Composer reads from sessionStorage, shows import banner with variant selector
   - Prefills topic/details with first variant if empty (does not overwrite)
   - Variant selector allows switching (only if user hasn't edited)
   - Clears payload and URL param after import/dismiss

### Implementation Files

- **Types:** `src/lib/apps/social-auto-poster/handoff/socialHandoffTypes.ts`
- **Parser:** `src/lib/apps/social-auto-poster/handoff/parseSocialHandoff.ts`
- **Composer Handler:** `src/app/apps/social-auto-poster/composer/page.tsx`
- **Banner Component:** `src/app/apps/social-auto-poster/ui/SessionCallout.tsx`

### Source App Integration Points

- **AI Content Writer:** `src/components/cw/CWExportCenterPanel.tsx`
- **Offers Builder:** `src/app/apps/offers-builder/page.tsx`
- **Event Campaign Builder:** `src/app/apps/event-campaign-builder/page.tsx`
- **Image Caption Generator:** (existing handoff system)

---

**End of Implementation Map**

