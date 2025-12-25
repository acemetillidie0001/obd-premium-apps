# Social Auto-Poster Image Integration (Phase 2B)

## Overview

The Social Auto-Poster V3+++ now integrates with the OBD Brand-Safe Image Generator to optionally generate images for social media posts. This integration is designed to be non-blocking: if image generation fails, posts will still publish normally as text-only.

## Workflow

1. **Generate Step** (`/api/social-auto-poster/generate`): 
   - Generates posts in memory (ephemeral, no DB writes)
   - Optionally generates images per post if `enableImages` is true
   - Returns previews with `image` field containing status/metadata
   - Images are cached by `requestId` (based on contentHash) to avoid regeneration

2. **Add to Queue** (`/api/social-auto-poster/queue/create`):
   - User clicks "Add to Queue" in composer UI
   - Extracts `image` field from preview
   - Persists image metadata to `SocialQueueItem` database fields
   - If image is missing, defaults to `imageStatus="skipped"`

3. **Posting**:
   - If `imageStatus="generated"` and `imageUrl` exists → attach image
   - Otherwise → post text-only

## Architecture

### Image Engine Client

The integration uses a client wrapper (`src/lib/apps/social-auto-poster/imageEngineClient.ts`) that:
- Calls `/api/image-engine/decision` and `/api/image-engine/generate`
- Never throws - always returns safe fallbacks
- Handles network failures gracefully

### Data Model

**Ephemeral (in-memory previews):**
- `PostImage` type with `status`, `url`, `altText`, `provider`, `aspect`, `category`, `fallbackReason`, `errorCode`, `requestId`
- Stored in `preview.image` and `draft.image` fields (not in metadata JSON)

**Persisted (database):**
- `SocialQueueItem` fields:
  - `imageStatus`: "skipped" | "generated" | "fallback"
  - `imageUrl`: Public URL to generated image (if successful)
  - `imageAltText`: Alt text for accessibility
  - `imageProvider`: Provider ID (e.g., "nano_banana")
  - `imageAspect`: Aspect ratio (e.g., "4:5")
  - `imageCategory`: Image category used
  - `imageErrorCode`: Error code if generation failed
  - `imageFallbackReason`: Human-readable fallback reason
  - `imageRequestId`: Stable request ID for caching (new)

### Settings

User-level settings in `SocialAutoposterSettings.imageSettings`:
- `enableImages`: boolean (default false)
- `imageCategoryMode`: "auto" | "educational" | "promotion" | "social_proof" | "local_abstract" | "evergreen" (default "auto")
- `allowTextOverlay`: boolean (default false)

## Integration Flow

1. **Post Generation** (`/api/social-auto-poster/generate`):
   - If `enableImages` is false → `preview.image = { status: "skipped" }`
   - If `enableImages` is true:
     - Compute stable `requestId` using `contentHash` (preferred) or content-based hash
     - Build `ImageEngineRequest` from post content (sanitized, no business name)
     - Call `generateImage()` with concurrency limit (max 2 concurrent)
     - Attach `image` field to preview: `{ status, url, altText, provider, aspect, category, requestId, ... }`
     - If generation fails → `image = { status: "fallback", fallbackReason, errorCode, ... }`
     - Failures never block the generate call; each post handled independently

2. **Queue Creation** (`/api/social-auto-poster/queue/create`):
   - Extract `image` field from preview payload
   - Map to database fields: `imageStatus`, `imageUrl`, `imageAltText`, etc.
   - If `image` is missing → default to `imageStatus="skipped"`, all fields null
   - Clean metadata JSON (image data stored separately, not in JSON)

3. **Posting**: When actually posting to social platforms:
   - If `imageStatus="generated"` and `imageUrl` exists → attach image
   - If fallback or skipped → post text only

## Category Mapping

The `inferImageCategoryFromPost()` function maps post content to image categories:
- Promotion keywords (discount, sale, offer) → "promotion"
- Educational keywords (tip, how-to, FAQ) → "educational"
- Social proof keywords (testimonial, review) → "social_proof"
- Location keywords (Ocala, local, community) → "local_abstract"
- Default → "evergreen"

## UI Updates

### Composer Page
- Shows image status badge on each preview
- Displays image thumbnail if generated
- Tooltip shows fallback reason if applicable

### Queue Page
- Shows image status badge per post
- Displays image thumbnail if generated
- Tooltip shows fallback reason

### Settings Page
- New "Image Generation (Optional)" section
- Toggle to enable/disable images
- Category mode selector
- Text overlay toggle

## Logging

**Client wrapper** (`imageEngineClient.ts`):
```typescript
{
  requestId: string,
  platform: string,
  ok: boolean
}
```

**Generate route**:
- One log line per post: `{ requestId, platform, imageStatus }`
- No raw prompts or full intent summaries logged
- No business names logged

## Exports

Activity log exports include `imageUrl`, `imageAltText`, and `imageRequestId` if present. Provider prompts are NOT exported.

## Smoke Test

To verify fallback behavior when image generation fails:

1. Ensure `GEMINI_API_KEY` is missing or invalid
2. Enable images in settings (`enableImages: true`)
3. Generate posts
4. Verify:
   - Posts are created successfully
   - `imageStatus="fallback"` is set
   - Posts can be added to queue and posted as text-only
   - No exceptions are thrown

## Migrations

Run migrations to add image fields:
1. `prisma/migrations/add_image_fields_to_social_queue/migration.sql` - Initial image fields
2. `prisma/migrations/add_image_request_id/migration.sql` - Add imageRequestId field

Or use Prisma migrate:
```bash
npx prisma migrate dev --name add_image_request_id
```

## Future Enhancements

- Image caching by requestId to avoid regenerating same images
- Retry logic (if needed, but currently single attempt per post)
- Image preview in queue drawer/modal
- Export image URLs in CSV/JSON exports

