# Social Auto-Poster V3A++ Release Notes

**Release Date:** December 25, 2024  
**Version:** V3A++  
**Status:** Production Ready (Mock Provider Only)

## Overview

OBD Social Auto-Poster V3A++ is a comprehensive social media content generation and scheduling system for local businesses. This release includes 8 major features for content variation, transparency, calendar management, platform controls, A/B testing, content pillars, local hashtag banks, and analytics.

## What Shipped

### Features 1-8 Summary

1. **Content Variation Memory (Anti-Repetition Engine)**
   - Content hashing and fingerprinting to detect similar posts
   - Automatic collision detection within 14-day window
   - UI warnings for similar content

2. **Post "Reason" Tags (Transparency Layer)**
   - Each post includes a human-readable reason
   - Theme categorization (education, promotion, social_proof, community, seasonal, general)
   - Displayed in composer previews

3. **Calendar View Toggle (Queue Upgrade)**
   - Month-view calendar for scheduled posts
   - Click posts to view details in drawer
   - Timezone-aware date handling

4. **Per-Platform Pause & Overrides**
   - Enable/disable platforms individually
   - Per-platform overrides for emoji mode, hashtag limits, CTA style
   - Generation logic respects disabled platforms

5. **Generate Variations (A/B-style Lite)**
   - Generate 2+ variations per platform
   - Selectable variant cards in composer
   - Choose preferred variant before queuing

6. **Content Pillars / Themes (User Steering)**
   - Selectable content pillars: Education, Promotion, Social Proof, Community, Seasonal
   - Single default or auto-rotate mode
   - Avoids repeating same pillar within recent history

7. **Local Hashtag Bank (Ocala-First, Rotating)**
   - Toggle local hashtag inclusion
   - Auto or manual rotation mode
   - Avoids same hashtag set within 7 days
   - Platform-specific limits respected

8. **Soft Analytics (Internal Metrics Only)**
   - Dashboard metrics: scheduled (7d/30d), success/failure rates
   - Platform distribution charts
   - Activity page deep link

## Pages & Routes

### Frontend Pages

- `/apps/social-auto-poster` - Dashboard with analytics
- `/apps/social-auto-poster/setup` - Settings configuration
- `/apps/social-auto-poster/composer` - Post generation
- `/apps/social-auto-poster/queue` - Queue management (List + Calendar views)
- `/apps/social-auto-poster/activity` - Activity log

### API Routes

- `POST /api/social-auto-poster/generate` - Generate posts with AI
- `GET /api/social-auto-poster/settings` - Fetch user settings
- `POST /api/social-auto-poster/settings` - Save user settings
- `POST /api/social-auto-poster/queue/create` - Create queue item
- `POST /api/social-auto-poster/queue/approve` - Approve/update queue item
- `GET /api/social-auto-poster/queue` - List queue items (with filters)
- `POST /api/social-auto-poster/queue/simulate-run` - Simulate posting (Mock Provider)
- `GET /api/social-auto-poster/activity` - Fetch activity log
- `GET /api/social-auto-poster/analytics` - Fetch analytics summary

## Data Model

### Tables

#### `SocialAutoposterSettings`
- One-to-one with User
- Fields: `brandVoice`, `postingMode`, `frequency`, `allowedDays`, `timeWindowStart/End`, `timezone`
- JSON fields: `platformsEnabled`, `platformOverrides`, `contentPillarSettings`, `hashtagBankSettings`

#### `SocialQueueItem`
- One-to-many with User
- Fields: `platform`, `content`, `status`, `scheduledAt`, `postedAt`, `errorMessage`, `attemptCount`
- Content variation: `contentTheme`, `contentHash`, `contentFingerprint`, `reason`, `isSimilar`
- JSON field: `metadata` (hashtags, images, etc.)

#### `SocialDeliveryAttempt`
- One-to-many with User and SocialQueueItem
- Fields: `platform`, `success`, `errorMessage`, `attemptedAt`
- JSON field: `responseData`

### Enums

- `SocialPlatform`: `facebook`, `instagram`, `x`, `googleBusiness`
- `PostingMode`: `review`, `auto`, `campaign`
- `QueueStatus`: `draft`, `approved`, `scheduled`, `posted`, `failed`
- `ContentPillar`: `education`, `promotion`, `social_proof`, `community`, `seasonal`, `general`

### Indexes

- `SocialQueueItem`: `userId`, `status`, `userId+status`, `scheduledAt`, `userId+scheduledAt`, `userId+platform+contentHash`, `contentHash`
- `SocialAutoposterSettings`: `userId` (unique)
- `SocialDeliveryAttempt`: `userId`, `queueItemId`, `userId+attemptedAt`, `success`

## QA Checklist

### Setup Page (`/apps/social-auto-poster/setup`)

- [ ] Load existing settings on page load
- [ ] Save settings successfully
- [ ] Brand voice textarea works
- [ ] Posting mode selection (review/auto/campaign)
- [ ] Frequency selection
- [ ] Days of week checkboxes
- [ ] Time window inputs (HH:mm format)
- [ ] Timezone selector
- [ ] Platform enable/disable toggles
- [ ] Platform overrides expand/collapse
- [ ] Content pillar mode (single/rotate)
- [ ] Default pillar selection
- [ ] Rotate pillars multi-select
- [ ] Local hashtag bank toggle
- [ ] Hashtag bank mode (auto/manual)
- [ ] Error handling for invalid inputs
- [ ] Success message on save

### Composer Page (`/apps/social-auto-poster/composer`)

- [ ] Form inputs: business name, type, topic, details
- [ ] Platform checkboxes
- [ ] Post length selector
- [ ] Campaign type selector
- [ ] Pillar override selector (if enabled)
- [ ] Generate button creates posts
- [ ] Loading state during generation
- [ ] Preview cards show for each platform
- [ ] Character count validation
- [ ] Similarity warning pills (if applicable)
- [ ] "Why this post:" reason display
- [ ] Hashtags section with regenerate button
- [ ] "Generate 2 more versions" button per platform
- [ ] Variant selection cards
- [ ] Queue button adds to queue
- [ ] Error handling for API failures
- [ ] Empty state when no previews

### Queue Page - List View (`/apps/social-auto-poster/queue`)

- [ ] Load queue items on page load
- [ ] Status filter dropdown (all/draft/approved/scheduled/posted/failed)
- [ ] List view toggle active
- [ ] Items display with platform, content preview, status, scheduled date
- [ ] Status pills with correct colors
- [ ] Approve button changes status to approved
- [ ] Delete button removes item
- [ ] Empty state when no items
- [ ] Loading state during fetch

### Queue Page - Calendar View (`/apps/social-auto-poster/queue`)

- [ ] Calendar view toggle active
- [ ] Month navigation (prev/next)
- [ ] Scheduled posts appear on correct dates
- [ ] Post indicators show platform icons
- [ ] Clicking post opens detail drawer
- [ ] Drawer shows full content, status, actions
- [ ] Drawer close button works
- [ ] Timezone-aware date display

### Activity Page (`/apps/social-auto-poster/activity`)

- [ ] Load activity items on page load
- [ ] Items show platform, status, posted date
- [ ] Success/failure indicators
- [ ] Expandable error details
- [ ] Empty state when no activity
- [ ] Loading state during fetch

### Dashboard Page (`/apps/social-auto-poster`)

- [ ] Analytics panel loads
- [ ] Metrics display: scheduled (7d/30d), success rate, failure rate
- [ ] Platform distribution grid
- [ ] Totals section (scheduled/posted/failed)
- [ ] "View Activity" link works
- [ ] Empty state when no data
- [ ] Loading state during fetch
- [ ] Quick action cards link correctly

## Known Limitations

### Mock Provider Only (V3A)

- **Posting is simulated only.** The `simulate-run` endpoint creates delivery attempts but does not actually post to social platforms.
- **V3B will add:** OAuth integration with Facebook, Instagram, X (Twitter), and Google Business Profile APIs for real posting.

### Other Limitations

- No image upload/generation in this release
- No bulk operations (approve all, delete all)
- No export functionality
- Analytics are internal-only (no external metrics integration)

## Technical Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL (Railway) with Prisma ORM
- **Styling:** Tailwind CSS + OBD V3 UI components
- **AI:** OpenAI API for content generation
- **Authentication:** NextAuth.js

## Migration Notes

- Migration applied: `20251225090040_add_social_auto_poster`
- All tables, indexes, and foreign keys created successfully
- JSON fields for settings stored as JSONB in PostgreSQL

## Next Steps (V3B)

1. OAuth integration for Facebook, Instagram, X, Google Business
2. Real posting API calls
3. Image upload/generation support
4. Bulk operations
5. Export functionality
6. External analytics integration

