# OBD Brand-Safe Image Generator - Phase 2A Testing Guide

## Quick Test Checklist

### 1. Test Decision Endpoint

```bash
curl -X POST http://localhost:3000/api/image-engine/decision \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test-001",
    "consumerApp": "social_auto_poster",
    "platform": "instagram",
    "category": "educational",
    "intentSummary": "An abstract educational image about local business tips"
  }'
```

**Expected**: Returns `ImageEngineDecision` with `mode: "generate"` or `mode: "fallback"`

### 2. Test Generation Endpoint (Decision Only)

```bash
curl -X POST http://localhost:3000/api/image-engine/generate \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test-002",
    "consumerApp": "social_auto_poster",
    "platform": "instagram",
    "category": "educational",
    "intentSummary": "An abstract educational image about local business tips"
  }'
```

**Expected**: Returns `ImageGenerationResult` with:
- `ok: false` (if provider not configured or fails)
- `fallback.used: true`
- `fallback.reason` explaining why

### 3. Test Generation Endpoint (With Provider)

**Prerequisites**: Set `GEMINI_API_KEY` environment variable

```bash
curl -X POST http://localhost:3000/api/image-engine/generate \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test-003",
    "consumerApp": "social_auto_poster",
    "platform": "instagram",
    "category": "educational",
    "intentSummary": "An abstract educational image about local business tips",
    "brand": {
      "primaryColorHex": "#FF5733",
      "styleTone": "friendly"
    },
    "locale": {
      "city": "Ocala",
      "region": "Florida"
    }
  }'
```

**Expected**: Returns `ImageGenerationResult` with:
- `ok: true` (if provider succeeds)
- `image.url` pointing to generated image
- `image.width`, `image.height`, `image.contentType`
- `timingsMs` showing performance metrics

### 4. Test Safety Rules (Should Trigger Fallback)

```bash
curl -X POST http://localhost:3000/api/image-engine/generate \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test-004",
    "consumerApp": "social_auto_poster",
    "platform": "instagram",
    "category": "social_proof",
    "intentSummary": "A 5-star review from John saying our team is great"
  }'
```

**Expected**: Returns `ImageGenerationResult` with:
- `ok: false`
- `decision.mode: "fallback"`
- `fallback.used: true`
- `fallback.reason` mentioning safety violation

### 5. Test Internal UI

1. Navigate to `/apps/image-generator`
2. Fill out the form
3. Toggle between "Decision Only" and "Generate Image"
4. Submit and verify:
   - Decision mode: Shows decision JSON
   - Generate mode: Shows image (if successful) or fallback reason

## Environment Variables

### Required for Generation

- `GEMINI_API_KEY` (optional): Google Gemini API key
  - If not set, provider will fail gracefully with fallback
  - Get from: https://makersuite.google.com/app/apikey

### Optional for Production Storage

- `BLOB_READ_WRITE_TOKEN`: Vercel Blob storage token
  - If not set, falls back to local storage (`/public/generated/`)

## Verification Steps

1. ✅ TypeScript compiles without errors
2. ✅ No lint errors
3. ✅ Decision endpoint returns valid JSON
4. ✅ Generation endpoint always returns 200 (never throws)
5. ✅ Fallback behavior works when provider fails
6. ✅ Safety rules trigger fallback correctly
7. ✅ Images stored in `/public/generated/` (dev) or Vercel Blob (prod)
8. ✅ Test UI displays results correctly

## Known Limitations (Phase 2A)

1. **Gemini API Integration**: The Nano Banana provider has a TODO for exact API endpoint verification. The current implementation is a placeholder that will need API shape confirmation.

2. **Vercel Blob**: The Vercel Blob storage adapter is a placeholder that falls back to local storage. To enable:
   - Install `@vercel/blob` package
   - Implement the adapter in `src/lib/image-engine/storage/vercelBlob.ts`
   - Set `BLOB_READ_WRITE_TOKEN` environment variable

3. **OpenAI Provider**: Not yet implemented (Phase 2B)

## Next Steps (Phase 2B)

- [ ] Verify Gemini Flash Image API endpoint and response format
- [ ] Implement Vercel Blob storage adapter
- [ ] Add OpenAI DALL-E provider
- [ ] Add image caching layer
- [ ] Add pre-generated fallback image assets

