# OBD Brand-Safe Image Generator

**App #22** | **Category 0 Infrastructure** | **Phase 1: Contract + Decision Logic** | **Phase 2A: Generation**

## Purpose

The OBD Brand-Safe Image Generator is a shared, API-first image engine that other OBD apps consume. It provides deterministic decision logic and actual image generation for image requests, ensuring brand safety and platform-appropriate outputs.

**Phase 1** implemented the service contract and decision algorithm only.

**Phase 2A** adds actual image generation via provider abstraction with graceful fallback behavior.

## Non-Goals

- ❌ No image editor UI
- ❌ No prompt playground
- ❌ No drag/drop interface

## Architecture

The image engine is structured as a headless service with the following components:

```
src/lib/image-engine/
├── types.ts          # TypeScript type definitions
├── constants.ts      # Platform defaults, category defaults
├── safety.ts         # Safety evaluation logic
├── prompts.ts        # Prompt template planning
├── decision.ts       # Main decision resolution
├── logger.ts         # Logging utilities (PII redacted)
├── assemble.ts       # Prompt assembly (Phase 2A)
├── size.ts           # Size resolution (Phase 2A)
├── providers/        # Provider implementations (Phase 2A)
│   ├── index.ts
│   ├── nanoBananaFlash.ts
│   └── stub.ts
├── storage/          # Storage adapters (Phase 2A)
│   ├── index.ts
│   ├── localDev.ts
│   └── vercelBlob.ts
└── index.ts          # Public API export
```

## Safety Rules

The image engine enforces strict brand safety rules:

### Hard-Locked Rules (Never Allowed)

1. **No Faces**: No staff/owner portraits, employee headshots, or team member images
2. **No Fake Locations**: No storefronts, buildings, or facility images
3. **No Medical/Legal Claims**: No cure, guarantee, diagnose, or lawsuit language
4. **No Before/After**: No transformation or results imagery
5. **No Fake Reviews**: No testimonials, customer quotes, or review language
6. **No Logos/Names**: No business names or logos burned into images (ever)

### Category-Specific Rules

- **social_proof**: Forbids any language implying real reviews/people. Must be abstract "trust/quality" visuals only.

### Fallback Behavior

If a request fails safety evaluation, the engine returns a safe fallback decision:
- `mode: "fallback"`
- `usedFallback: true`
- Template: `SAFE_GENERIC_ABSTRACT_V1`
- Text allowance: `"none"`

**Image failures must never block posting/output** - the engine always returns a decision or generation result with graceful fallback.

## Request Schema

```typescript
interface ImageEngineRequest {
  requestId: string;                 // Required, from consumer app
  consumerApp: ConsumerApp;          // Which app is making the request
  platform: ImagePlatform;           // Target platform
  category: ImageCategory;           // Image category
  intentSummary: string;             // Short description of image intent
  brand?: BrandKitInfluence;         // Optional brand influence
  locale?: { city?: string; region?: string }; // Optional locale context
  allowTextOverlay?: boolean;         // Default: false
  safeMode?: "strict";               // Default: "strict"
}
```

### Supported Platforms

- `instagram` → Aspect: `4:5` (default)
- `facebook` → Aspect: `4:5`
- `x` → Aspect: `16:9`
- `google_business_profile` → Aspect: `4:3`
- `blog` → Aspect: `16:9`

### Supported Categories

- `educational` → Energy: medium, Text: minimal (default none)
- `promotion` → Energy: high, Text: headline_only (default none)
- `social_proof` → Energy: medium, Text: none (never allow testimonial claims)
- `local_abstract` → Energy: low, Text: none
- `evergreen` → Energy: low, Text: minimal (default none)

## Decision Schema

```typescript
interface ImageEngineDecision {
  requestId: string;
  mode: "generate" | "fallback";
  platform: ImagePlatform;
  aspect: ImageAspect;
  category: ImageCategory;
  energy: "low" | "medium" | "high";
  text: {
    allowance: "none" | "minimal" | "headline_only";
    recommendedOverlayText?: string | null;
  };
  safety: {
    isAllowed: boolean;
    reasons: string[];
    usedFallback: boolean;
  };
  promptPlan: {
    templateId: string;
    negativeRules: string[];
    variables: Record<string, string>;
  };
  providerPlan: {
    providerId: "nano_banana" | "openai" | "other";
    modelTier: "flash" | "pro";
    notes?: string;
  };
}
```

## API Endpoints

### POST `/api/image-engine/decision`

Returns a decision about image generation (no actual generation).

#### Request Body

See `ImageEngineRequest` schema above.

#### Response

Returns `ImageEngineDecision` JSON object.

#### Error Responses

- `400 Bad Request`: Invalid request body or missing required fields
- `500 Internal Server Error`: Server error

### POST `/api/image-engine/generate` (Phase 2A)

Generates an actual image based on the request.

#### Request Body

See `ImageEngineRequest` schema above.

#### Response

Returns `ImageGenerationResult` JSON object:

```typescript
interface ImageGenerationResult {
  requestId: string;
  ok: boolean;                    // true if image generated, false if fallback used
  decision: ImageEngineDecision;
  image?: {
    url: string;                   // public URL or signed URL
    width: number;
    height: number;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    altText: string;
  };
  fallback?: {
    used: boolean;
    reason: string;
    placeholderUrl?: string;
  };
  error?: {
    code: string;
    message: string;
  };
  timingsMs: {
    decision: number;
    provider?: number;
    storage?: number;
    total: number;
  };
}
```

#### Important: Non-Blocking Behavior

- **Always returns 200 OK** (consumers must check `ok` field in response)
- If generation fails, `ok=false` with `fallback.used=true` and reason
- Never throws errors - all failures are handled gracefully
- Image failures never block downstream apps

#### Error Responses

- `400 Bad Request`: Invalid request body or missing required fields
- `500 Internal Server Error`: Server error (rare, only for validation failures)

## Provider Abstraction (Phase 2A)

The image engine uses a provider abstraction pattern:

```typescript
interface ImageProvider {
  id: ImageProviderId;
  generate(args: {
    decision: ImageEngineDecision;
    prompt: string;
    width: number;
    height: number;
    contentType: "image/png" | "image/jpeg" | "image/webp";
  }): Promise<{
    bytes: Uint8Array;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    width: number;
    height: number;
  }>;
}
```

### Supported Providers

- **nano_banana** (default): Gemini Flash Image API
- **openai**: OpenAI DALL-E (TODO: Phase 2B)
- **other**: Stub provider (dev fallback)

Provider selection is based on `decision.providerPlan.providerId`.

## Storage Abstraction (Phase 2A)

The image engine uses a storage abstraction pattern:

```typescript
interface ImageStorage {
  put(args: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ url: string }>;
}
```

### Storage Adapters

- **Development**: Local file system (`/public/generated/`)
- **Production**: Vercel Blob (if `BLOB_READ_WRITE_TOKEN` is set), otherwise local fallback

Storage selection is automatic based on environment.

## Integration Notes

### For Social Auto-Poster

The Social Auto-Poster app can integrate the image engine as follows:

```typescript
import { ImageEngine } from "@/lib/image-engine";

// Option 1: Decision only
const decision = ImageEngine.decide({
  requestId: `sap-${postId}`,
  consumerApp: "social_auto_poster",
  platform: "instagram",
  category: "educational",
  intentSummary: "Abstract educational image about local business tips",
  brand: {
    primaryColorHex: "#FF5733",
    styleTone: "friendly",
    industry: "Restaurant",
  },
  locale: {
    city: "Ocala",
    region: "Florida",
  },
  allowTextOverlay: false,
  safeMode: "strict",
});

// Option 2: Generate image (Phase 2A)
const result = await ImageEngine.generate({
  requestId: `sap-${postId}`,
  consumerApp: "social_auto_poster",
  platform: "instagram",
  category: "educational",
  intentSummary: "Abstract educational image about local business tips",
  brand: {
    primaryColorHex: "#FF5733",
    styleTone: "friendly",
    industry: "Restaurant",
  },
  locale: {
    city: "Ocala",
    region: "Florida",
  },
  allowTextOverlay: false,
  safeMode: "strict",
});

if (result.ok && result.image) {
  // Use result.image.url in post
  console.log("Image generated:", result.image.url);
} else {
  // Handle fallback - never blocks posting
  console.log("Fallback used:", result.fallback?.reason);
}
```

### Deterministic Behavior

The decision engine is **deterministic**: same input always produces the same output. No randomness is used.

### Logging

- Request IDs are logged (safe)
- Intent summaries are redacted (hashed/trimmed)
- Brand colors are never logged (redacted)
- Decision IDs combine: `requestId-platform-category`

## Phase 2A Status

✅ **Completed**:
- Provider abstraction with Nano Banana (Gemini Flash) implementation
- Storage abstraction with local dev and Vercel Blob adapters
- Generation API endpoint (`/api/image-engine/generate`)
- Non-blocking behavior (never throws, always returns result)
- Graceful fallback handling

## Phase 2B Roadmap

Future enhancements:

1. **OpenAI Provider**: DALL-E integration
2. **Fallback Image Assets**: Pre-generated safe fallback images
3. **Image Caching**: Cache generated images for reuse
4. **Consumer Integration**: Full integration with Social Auto-Poster and other apps

## Testing

An internal test harness is available at:

**`/apps/image-generator`**

This page allows testing both decision logic and image generation:
- **Decision Only**: Test decision engine without generation
- **Generate Image**: Test full generation pipeline

The page displays:
- Decision results (JSON)
- Generated images (if successful)
- Fallback reasons (if generation fails)
- Full response JSON

## Environment Variables

Required for image generation:

- `GEMINI_API_KEY` (optional): Google Gemini API key for Nano Banana provider
  - If not set, provider will fail gracefully with fallback

Optional for production storage:

- `BLOB_READ_WRITE_TOKEN`: Vercel Blob storage token
  - If not set, falls back to local storage

## Files

### Core Engine
- `src/lib/image-engine/types.ts` - Type definitions
- `src/lib/image-engine/constants.ts` - Constants and defaults
- `src/lib/image-engine/safety.ts` - Safety evaluation
- `src/lib/image-engine/prompts.ts` - Prompt planning
- `src/lib/image-engine/decision.ts` - Decision resolution
- `src/lib/image-engine/logger.ts` - Logging utilities
- `src/lib/image-engine/assemble.ts` - Prompt assembly (Phase 2A)
- `src/lib/image-engine/size.ts` - Size resolution (Phase 2A)
- `src/lib/image-engine/index.ts` - Public API

### Providers (Phase 2A)
- `src/lib/image-engine/providers/index.ts` - Provider registry
- `src/lib/image-engine/providers/nanoBananaFlash.ts` - Gemini Flash provider
- `src/lib/image-engine/providers/stub.ts` - Dev fallback provider

### Storage (Phase 2A)
- `src/lib/image-engine/storage/index.ts` - Storage registry
- `src/lib/image-engine/storage/localDev.ts` - Local dev storage
- `src/lib/image-engine/storage/vercelBlob.ts` - Vercel Blob storage

### API Routes
- `src/app/api/image-engine/decision/route.ts` - Decision endpoint
- `src/app/api/image-engine/generate/route.ts` - Generation endpoint (Phase 2A)

### UI
- `src/app/apps/image-generator/page.tsx` - Internal test page

