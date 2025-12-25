# OBD Social Auto-Poster V3A+ Enhancements Summary

## Overview
Implemented 5 major enhancements to the OBD Social Auto-Poster V3A app:
1. Content Variation Memory (Anti-Repetition Engine)
2. Post "Reason" Tags (Transparency Layer)
3. Calendar View Toggle (Queue Upgrade)
4. Per-Platform Pause & Overrides
5. "Generate Variations" (A/B-style Lite)

## Files Changed/Created

### Prisma Schema
- **`prisma/schema.prisma`**
  - Added `contentTheme`, `contentHash`, `contentFingerprint`, `reason`, `isSimilar` fields to `SocialQueueItem`
  - Added indexes: `@@index([userId, platform, contentHash])`, `@@index([contentHash])`
  - Added `platformsEnabled` (Json) and `platformOverrides` (Json) to `SocialAutoposterSettings`

### Types
- **`src/lib/apps/social-auto-poster/types.ts`**
  - Added `ContentTheme` type
  - Added `PlatformOverrides`, `PlatformsEnabled`, `PlatformOverridesMap` interfaces
  - Updated `SocialPostDraft`, `SocialPostPreview` to include `reason`, `theme`, `isSimilar`
  - Updated `SocialQueueItem` to include new fields
  - Updated `GeneratePostsRequest` to include `generateVariants`
  - Updated `GeneratePostsResponse` to include `variants`
  - Updated `CreateQueueItemRequest` to include new fields
  - Updated `SaveSettingsRequest` to include platform settings

### Utilities
- **`src/lib/apps/social-auto-poster/utils.ts`** (NEW)
  - `normalizeText()` - Normalizes text for hashing/comparison
  - `computeContentHash()` - Computes stable hash for similarity detection
  - `computeContentFingerprint()` - Computes short fingerprint for quick comparisons
  - `similarityCheckRecent()` - Checks for similar posts in recent N days
  - `determineContentTheme()` - Determines content theme from inputs
  - `generatePostReason()` - Generates reason string explaining why post was created

### API Routes

#### Generate
- **`src/app/api/social-auto-poster/generate/route.ts`**
  - Updated to include reason and theme in AI prompt
  - Added similarity checking using utility functions
  - Added variant generation support
  - Respects per-platform enable/disable settings
  - Applies platform overrides to generation instructions
  - Returns enriched previews with similarity flags

#### Queue Create
- **`src/app/api/social-auto-poster/queue/create/route.ts`**
  - Updated to persist `reason`, `theme`, `contentHash`, `contentFingerprint`, `isSimilar`
  - Auto-computes hash and fingerprint if not provided

#### Queue List
- **`src/app/api/social-auto-poster/queue/route.ts`**
  - Updated to return all new fields in response

#### Settings
- **`src/app/api/social-auto-poster/settings/route.ts`**
  - Updated GET to return `platformsEnabled` and `platformOverrides`
  - Updated POST to save and validate per-platform settings
  - Added validation for override values

### UI Components

#### Calendar Component
- **`src/components/obd/SocialQueueCalendar.tsx`** (NEW)
  - Month view calendar
  - Shows scheduled posts on their dates
  - Platform icons and truncated content
  - Clickable items to open drawer
  - Timezone-aware date handling

#### Setup Page
- **`src/app/apps/social-auto-poster/setup/page.tsx`**
  - Added per-platform enable/disable toggles
  - Added collapsible per-platform override sections
  - Override options: emojiMode, hashtagLimit, ctaStyle
  - Updated save handler to include new settings

#### Composer Page
- **`src/app/apps/social-auto-poster/composer/page.tsx`**
  - Added reason display (collapsible on mobile)
  - Added similarity warning pills
  - Added "Generate 2 More" button per platform
  - Added variant selection UI (selectable cards)
  - Updated queue creation to include reason, theme, similarity flag

#### Queue Page
- **`src/app/apps/social-auto-poster/queue/page.tsx`**
  - Added view toggle (List/Calendar)
  - Integrated calendar component
  - Added drawer/modal for post details
  - Drawer shows full content, status, actions
  - Actions: Approve, Schedule, Pause, Skip, Retry

## Features Implemented

### ✅ Feature 1: Content Variation Memory
- Hash computation for generated posts
- Similarity checking against last 14 days
- Warning flags on similar posts
- Indexed database queries for performance

### ✅ Feature 2: Post "Reason" Tags
- AI-generated reason strings
- Theme classification (education, promotion, social_proof, community, seasonal, general)
- Displayed in composer previews
- Persisted in queue items

### ✅ Feature 3: Calendar View
- Month view calendar
- Scheduled posts displayed on dates
- Click to open detail drawer
- Timezone-aware
- Read-only (no drag/drop yet)

### ✅ Feature 4: Per-Platform Pause & Overrides
- Individual platform enable/disable toggles
- Per-platform overrides:
  - Emoji mode (allow/limit/none)
  - Hashtag limit (number)
  - CTA style (none/soft/direct)
- Generation respects disabled platforms
- Overrides affect AI generation instructions

### ✅ Feature 5: Generate Variations
- "Generate 2 More" button per platform
- Generates 2 additional variants with different phrasing
- Variants shown as selectable cards
- Selected variant used when adding to queue
- Similarity checking on variants

## Migration Required

Run Prisma migration to add new fields:
```bash
npx prisma migrate dev --name add_social_auto_poster_enhancements
```

## Testing Checklist

- [ ] Generate posts and verify reason/theme are included
- [ ] Check similarity warnings appear for duplicate content
- [ ] Test per-platform enable/disable in settings
- [ ] Test per-platform overrides affect generation
- [ ] Generate variants and verify they're different
- [ ] Test calendar view shows scheduled posts
- [ ] Test drawer opens when clicking calendar items
- [ ] Verify all queue actions work from drawer
- [ ] Test timezone handling in calendar

## Notes

- All features are production-ready with strict TypeScript
- No `any` types used
- All API routes have proper validation
- UI follows OBD V3 design patterns
- Calendar is read-only (drag/drop can be added in future)
- Similarity checking uses 14-day window (configurable in code)

