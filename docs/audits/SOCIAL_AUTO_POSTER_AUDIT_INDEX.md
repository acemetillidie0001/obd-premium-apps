# OBD Social Auto-Poster — Audit Index (Pass 1)

**Scope:** File index and responsibilities mapping (no code changes)

---

## Page Responsibilities

### 1. Dashboard (`src/app/apps/social-auto-poster/page.tsx`)
**Main Responsibilities:**
- Display analytics summary (scheduled, posted, success/failure rates, platform distribution)
- Show queue status overview (counts by status: draft, approved, scheduled)
- Display connection status badge with publishing state
- Provide quick action links to Setup, Composer, Queue, Activity pages

**Key State Variables:**
- `analytics` (AnalyticsSummary) - metrics data
- `queueItems` - queue items for status counts
- `connectionStatus` - Meta connection state
- `loading`, `queueLoading` - loading states
- `theme` - UI theme

**Key API Endpoints:**
- `GET /api/social-auto-poster/analytics` - load analytics summary
- `GET /api/social-auto-poster/queue` - load queue items for counts
- `GET /api/social-connections/meta/status` - connection status

**Connection UI Model:**
- Computed: `getConnectionUIModel(connectionStatus, undefined, publishingEnabled)` at lines 115, 180
- Used: ConnectionStatusBadge component, analytics conditional messaging

**Handoff Import:**
- None (dashboard only displays data)

---

### 2. Setup (`src/app/apps/social-auto-poster/setup/page.tsx`)
**Main Responsibilities:**
- Configure brand voice, posting mode (review/auto/campaign), scheduling rules
- Manage Meta (Facebook/Instagram) connection: connect, disconnect, request pages access
- Manage Google Business Profile connection: connect, disconnect, select location
- Configure platform settings (enabled platforms, overrides, content pillars)
- Test post functionality for Meta and Google
- Display setup progress and completion status

**Key State Variables:**
- `settings` (SocialAutoposterSettings) - all configuration
- `connectionStatus` - Meta connection state
- `googleStatus` - Google Business Profile connection state
- `isPremiumUser` - premium subscription status
- `saving`, `loading` - operation states
- `expandedPlatforms` - UI state for platform sections

**Key API Endpoints:**
- `GET /api/social-auto-poster/settings` - load settings
- `POST /api/social-auto-poster/settings` - save settings
- `GET /api/social-connections/meta/status` - Meta connection status
- `POST /api/social-connections/meta/connect` - initiate Meta OAuth
- `POST /api/social-connections/meta/disconnect` - disconnect Meta
- `POST /api/social-connections/meta/request-pages-access` - request pages permission
- `POST /api/social-connections/meta/test-post` - test Meta posting
- `GET /api/social-connections/google/status` - Google connection status
- `POST /api/social-connections/google/connect` - initiate Google OAuth
- `POST /api/social-connections/google/disconnect` - disconnect Google
- `POST /api/social-connections/google/test-post` - test Google posting
- `POST /api/social-connections/google/select-location` - select Google location

**Connection UI Model:**
- Computed: `getConnectionUIModel(connectionStatus, undefined, publishingEnabled)` at lines 717, 760, 787, 1043, 1516, 1538
- Used: ConnectionStatusBadge, connection status display, conditional UI rendering

**Handoff Import:**
- None (setup only manages configuration)

---

### 3. Composer (`src/app/apps/social-auto-poster/composer/page.tsx`)
**Main Responsibilities:**
- Generate platform-optimized social posts via AI (form input → previews)
- Handle handoff imports from multiple sources (image-caption-generator, event-campaign-builder, offers-builder, ai-content-writer)
- Display post previews with character counts, variants, hashtags, images
- Add generated posts to queue
- Support CRM integration prefill (contact context, intent-based starter text)
- Manage event countdown variant selection (for event handoffs)

**Key State Variables:**
- `formData` (GeneratePostsRequest) - generation form inputs
- `settings` - loaded settings for defaults (platforms, brand voice)
- `connectionStatus` - connection state
- `previews` (SocialPostPreview[]) - generated post previews
- `variants` - platform-specific variant options
- `selectedVariants` - selected variant indices per platform
- `handoffPayload` (SocialAutoPosterHandoffPayload) - legacy handoff data
- `handoffHash` - handoff deduplication hash
- `canonicalHandoff` (SocialComposerHandoffPayload) - canonical handoff data
- `handoffImportCompleted` - handoff processing completion flag
- `selectedCountdownIndex` - event countdown variant selection

**Key API Endpoints:**
- `GET /api/social-auto-poster/settings` - load settings for defaults
- `POST /api/social-auto-poster/generate` - generate posts
- `POST /api/social-auto-poster/queue/create` - add post to queue
- `GET /api/social-connections/meta/status` - connection status
- `GET /api/social-auto-poster/queue` - check for duplicates (handoff import)
- `GET /api/obd-crm/contacts/{contactId}/summary` - CRM contact context

**Connection UI Model:**
- Computed: `getConnectionUIModel(connectionStatus, undefined, publishingEnabled)` at line 1027
- Used: ConnectionStatusBadge component

**Handoff Import:**
- **Location:** Multiple useEffect hooks and handler functions (lines 147-183, 194-315, 396-550, 552-631, 633-709, 711-728)
- **Parsing:** 
  - `parseSocialAutoPosterHandoff(searchParams)` - legacy handoff (line 160)
  - `parseSocialHandoff(searchParams)` - canonical handoff (line 204)
- **Guarding:**
  - `wasHandoffAlreadyImported("social-auto-poster", handoffHash)` - duplicate check (line 403)
  - `markHandoffImported("social-auto-poster", handoffHash)` - mark as imported (lines 509, 603, 681)
  - Empty composer check before import (lines 562-573, 643-654)
- **Handlers:**
  - `handleImportCaptions()` - image-caption-generator handoff
  - `handleImportEvent()` - event-campaign-builder handoff
  - `handleImportOffer()` - offers-builder handoff
  - Canonical handoff auto-prefill (lines 194-315)

---

### 4. Queue (`src/app/apps/social-auto-poster/queue/page.tsx`)
**Main Responsibilities:**
- Display queue items in list or calendar view
- Manage post status transitions (draft → approved → scheduled)
- Bulk actions (approve, schedule, delete multiple items)
- Schedule posts with date/time selection
- Display image status and handle image regeneration
- Filter by status (all, draft, approved, scheduled, posted, failed)
- Show connection status and blocked state indicators

**Key State Variables:**
- `items` (SocialQueueItem[]) - queue items
- `filter` (QueueStatus | "all") - status filter
- `viewMode` ("list" | "calendar") - display mode
- `selectedIds` (Set<string>) - bulk selection
- `connectionStatus` - connection state
- `imageInfoMap` - image status per item
- `regeneratingIds` - image regeneration state
- `bulkActionProgress` - bulk operation progress

**Key API Endpoints:**
- `GET /api/social-auto-poster/queue` - load queue items (with optional ?status filter)
- `POST /api/social-auto-poster/queue/approve` - change status (approve/schedule/pause)
- `DELETE /api/social-auto-poster/queue/delete` - delete item
- `GET /api/social-auto-poster/queue/image?queueItemId={id}` - get image info
- `POST /api/social-auto-poster/queue/image/regenerate` - regenerate image
- `GET /api/social-connections/meta/status` - connection status

**Connection UI Model:**
- Computed: `getConnectionUIModel(connectionStatus, undefined, publishingEnabled)` at lines 473, 606, 729, 940
- Used: ConnectionStatusBadge, queue status chip determination (via `getQueueStatusChip()`), bulk action messaging

**Handoff Import:**
- None (queue only manages existing items)

---

### 5. Activity (`src/app/apps/social-auto-poster/activity/page.tsx`)
**Main Responsibilities:**
- Display activity log (posted/failed posts with delivery attempts)
- Show delivery attempt details (success/failure, timestamps, error messages)
- Display permalinks and post IDs for successful posts
- Map activity items to user-friendly UI messages (via activityMessageMapper)
- Show retry policy information
- Expandable attempt history per item

**Key State Variables:**
- `items` (ActivityLogItem[]) - activity log entries
- `expandedItems` (Set<string>) - expanded item IDs
- `connectionStatus` - connection state
- `loading`, `error` - operation states

**Key API Endpoints:**
- `GET /api/social-auto-poster/activity` - load activity log
- `GET /api/social-connections/meta/status` - connection status

**Connection UI Model:**
- Computed: `getConnectionUIModel(connectionStatus, undefined, publishingEnabled)` at lines 111, 182
- Used: ConnectionStatusBadge, activity message mapping (via `mapActivityToUI()`)

**Handoff Import:**
- None (activity only displays history)

---

## Top 3 Supporting Files (from imports)

1. **`src/lib/apps/social-auto-poster/connection/connectionState.ts`**
   - Exports: `getConnectionUIModel()`
   - Used by: All 5 pages for connection status UI computation
   - Purpose: Centralized connection state → UI model transformation

2. **`src/lib/apps/social-auto-poster/handoff-parser.ts`**
   - Exports: `parseSocialAutoPosterHandoff()`, `normalizePlatform()`, `SocialAutoPosterHandoffPayload`
   - Used by: Composer page for legacy handoff parsing
   - Purpose: Parse URL params and localStorage handoff data

3. **`src/lib/apps/social-auto-poster/metaConnectionStatus.ts`**
   - Exports: `isMetaPublishingEnabled()`, `getMetaPublishingBannerMessage()`
   - Used by: All 5 pages for publishing state checks
   - Purpose: Determine if Meta publishing is enabled (feature flag + connection state)

---

**Audit Date:** 2024-12-19  
**Scope:** File index only (no code modifications)

