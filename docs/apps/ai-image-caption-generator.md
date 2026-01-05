# AI Image Caption Generator - Tier 4 + Tier 5A + Tier 5C Implementation

**Status:** ✅ Production Ready (STABLE / LIVE)

**Last Updated:** 2025-01-XX

## Overview

The AI Image Caption Generator helps businesses create platform-optimized social media captions for images. The app has been upgraded to Tier 4 (canonical patterns and hardening), Tier 5A (UX consistency), and Tier 5C (ecosystem integrations) standards.

## Purpose & Workflows

### Primary Use Cases

1. **Social Media Captions**: Generate captions optimized for Facebook, Instagram, X (Twitter), and Google Business Profile
2. **Platform-Specific Optimization**: Automatic character limit awareness and formatting per platform
3. **Hashtag Management**: Generate and manage hashtags with local, branded, or mixed styles
4. **Content Variations**: Create multiple caption variations with different tones and styles
5. **Ecosystem Integration**: Send captions directly to Social Auto-Poster for scheduling

### Typical Workflow

1. **Input Business Details**: Fill out form with business name, type, location, and image context
2. **Configure Platform & Goals**: Select target platform(s), goal (Awareness, Promotion, etc.), and caption length
3. **Set Brand Voice**: Configure brand voice, personality style, and tone preferences
4. **Generate Captions**: Click "Write Captions" to create multiple caption variations
5. **Edit & Refine**: Use inline editing to customize individual captions
6. **Select & Export**: Select specific captions or export all in various formats
7. **Send to Social Auto-Poster**: Use Next Steps panel to send captions for scheduling

## Tier 4 Implementation: Canonical State Management

### CaptionItem Schema

The app uses a normalized `CaptionItem` type for all state management:

```typescript
interface CaptionItem {
  id: string;                    // Stable string ID (converted from numeric API ID)
  platform: string;              // "facebook" | "instagram" | "google" | etc.
  goal?: string | null;          // "Awareness" | "Promotion" | etc.
  tone?: string | null;          // Tone description
  length?: "short" | "medium" | "long" | string | null;
  caption: string;               // The caption text (mapped from "text" field)
  hashtags?: string[] | null;    // Array of hashtag strings
  createdAt?: number;            // Optional local timestamp
  // Display-only fields (preserved from original Caption for UI)
  label?: string;
  lengthMode?: CaptionLength;
  variationMode?: VariationMode;
  previewHint?: string;
}
```

### Mapping Rules

**API Response → CaptionItem:**
- `Caption.id` (number) → `CaptionItem.id` (string via `crypto.randomUUID()` or string conversion)
- `Caption.text` → `CaptionItem.caption`
- `Caption.platform` → `CaptionItem.platform` (normalized to lowercase)
- `Caption.hashtags` → `CaptionItem.hashtags` (preserved as array)
- Display fields (`label`, `lengthMode`, `variationMode`, `previewHint`) preserved for UI

**Mapper Function:** `mapCaptionsToItems()` in `src/lib/apps/image-caption-generator/caption-mapper.ts`

### State Hierarchy

The app maintains three distinct caption state layers:

1. **`generatedCaptions`**: Generated captions from API response (read-only)
   - Mapped from API `Caption[]` to `CaptionItem[]`
   - Format: `CaptionItem[]` with stable string IDs
   - Never mutated directly

2. **`editedCaptions`**: User-edited captions (mutable)
   - Created when user edits any caption
   - Takes precedence over `generatedCaptions` in canonical selector
   - Automatically cleared when new captions are generated

3. **`activeCaptions` / `getActiveCaptions()`**: Canonical selector (computed)
   - **Function:** `getActiveCaptions(generatedCaptions, editedCaptions): CaptionItem[]`
   - **Location:** `src/lib/apps/image-caption-generator/getActiveCaptions.ts`
   - **Logic:** `return editedCaptions ?? generatedCaptions ?? []`
   - **Usage:** All downstream operations MUST use this selector
   - **Purpose:** Single source of truth for current caption state

### Canonical Selector Rules

**Always use `getActiveCaptions()` or `activeCaptions` for:**
- Display in UI
- Export operations
- Copy operations (individual and bulk)
- Selection management
- Cross-app handoffs
- Validation checks

**Never use `generatedCaptions` or `editedCaptions` directly** unless:
- Resetting to original (`generatedCaptions`)
- Detecting edit state (checking `editedCaptions !== null`)

### State Reset Behavior

- **New API Response**: Automatically clears `editedCaptions` and `selectedCaptionIds`
- **Edit Operations**: Updates `editedCaptions`, preserves `selectedCaptionIds`
- **Regenerate**: Clears both `editedCaptions` and `selectedCaptionIds`

## Inline Editing System

### Edit Workflow

1. **Start Editing**: Click "Edit" button on any caption card
   - Sets `editingId` to caption ID (string)
   - Populates `editText` with current caption text
   - Card switches to edit mode (textarea replaces display)

2. **Save Changes**: Click "Save" button
   - Validates caption text is non-empty (trimmed)
   - Creates/updates `editedCaptions` array with new text
   - Preserves all other caption fields (platform, hashtags, etc.)
   - Clears `editingId` to exit edit mode
   - Shows toast: "Caption saved"

3. **Cancel Editing**: Click "Cancel" button
   - Clears `editingId` without saving
   - Restores original text from `activeCaptions`
   - No state changes

### Character Count Feedback

- Platform-specific character limits displayed during editing
- Real-time feedback with color coding:
  - **Error** (red): Exceeds platform limit (X: 280, Google Business: 1500)
  - **Warning** (yellow): Near limit (X: 260+, Instagram Story: 100+)
  - **Default** (muted): Within normal range

## CaptionCard Component

**Location:** `src/components/image-caption-generator/CaptionCard.tsx`

### Behaviors

1. **Copy**: Individual caption copy with toast feedback
2. **Edit**: Inline editing with character count
3. **Select**: Checkbox toggle for bulk operations
4. **Display**: Platform chip, goal/length/tone chips (if present), caption text, hashtags

### Props

```typescript
interface CaptionCardProps {
  caption: CaptionItem;
  isSelected: boolean;
  onToggleSelected: (id: string) => void;
  onCopy: (id: string) => void;
  onEdit: (id: string) => void;
  onSave: (id: string, text: string) => void;
  onCancel: () => void;
  isDark: boolean;
  editingId: string | null;
  editText: string;
  onEditTextChange: (text: string) => void;
  copiedId: string | null;
}
```

## Selection & Bulk Operations

### Selection State

- **Type:** `Set<string>` (caption IDs)
- **State:** `selectedCaptionIds: Set<string>`
- **Operations:**
  - `handleToggleSelected(id)`: Toggle selection for a caption
  - `handleClearSelection()`: Clear all selections

### Bulk Copy Operations

**Copy Selected:**
- Uses `pickSelectedCaptions(activeCaptions, selectedCaptionIds)`
- Formats using `formatCaptionsPlain()`
- Toast: "Copied X captions"
- Disabled when `selectedCaptionIds.size === 0`

**Copy All:**
- Uses all `activeCaptions`
- Formats using `formatCaptionsPlain()`
- Toast: "Copied all captions"
- Disabled when `activeCaptions.length === 0`

### Formatting Rules

**Plain Text Format:**
- Grouped by platform with headers: `=== Platform ===`
- Each caption separated by blank line
- Hashtags appended as separate line: `#tag1 #tag2`
- Platform headers capitalized

**CSV Format:**
- Headers: `caption,platform,goal,hashtags`
- Hashtags: Space-joined with `#` prefix: `"#tag1 #tag2"`
- Proper CSV escaping for quotes, commas, newlines
- Function: `formatCaptionsCsv()` in `caption-export-formatters.ts`

## Export Center

**Component:** `src/components/image-caption-generator/CaptionExportCenterPanel.tsx`

### Export Formats

1. **Plain Text**
   - Platform-grouped text format
   - Copy to clipboard
   - Download as `captions.txt`

2. **Platform Blocks**
   - Same output as Plain Text (reuses `formatCaptionsPlain`)
   - Labeled separately in UI
   - Copy to clipboard
   - Download as `captions.txt`

3. **CSV**
   - Structured data format with headers
   - Copy to clipboard
   - Download as `captions.csv`
   - Proper CSV escaping via `escapeCsvField()`

### CSV Escaping Rules

- Fields containing comma, quote, or newline are wrapped in double quotes
- Internal double quotes are escaped by doubling: `"` → `""`
- Empty/null fields are represented as empty strings

## Tier 5A UX Consistency

### Sticky Action Bar

**Component:** `OBDStickyActionBar` from `@/components/obd/OBDStickyActionBar`

**Buttons:**
- **Primary:** "Write Captions" (Generate)
- **Secondary:** "Regenerate", "Copy Selected", "Copy All", "Export", "Reset"
- **State Chip:** "Generated" vs "Edited" (based on `editedCaptions !== null`)

**UX Rules:**
- Disabled-not-hidden: All buttons visible but disabled when appropriate
- Tooltips: Clear messaging for disabled states
- Mobile-safe: Bottom padding via `OBD_STICKY_ACTION_BAR_OFFSET_CLASS`
- Safe-area: Respects mobile browser chrome

### Accordion Input Sections

**Sections (exact order):**
1. **Business Basics** (default open)
2. **Image Context**
3. **Platform & Goal**
4. **Brand Voice**
5. **Hashtags & Variations**
6. **Advanced Options**

**Live Summary Lines:**
- **Business Basics:** `"{businessName || 'Business'} · {city,state if set}"`
- **Image Context:** `"Set" / "Not set"` (or first ~40 chars)
- **Platform & Goal:** `"{platforms} · {goal || 'Goal'} · {length || 'Length'}"`
- **Brand Voice:** `"{tone/voice summary} · Using Brand Kit (if applicable)"`
- **Hashtags & Variations:** `"Hashtags: On/Off · Variations: {n}"`
- **Advanced Options:** `"Language: {lang} · Emojis: On/Off"`

**UX Rules:**
- Default open: Business Basics only; others collapsed
- Expand/Collapse buttons with clear labels
- Summary lines visible when collapsed
- Consistent spacing and typography with OBD panels

## Tier 5C: Ecosystem Integration

### Next Steps Panel

**Component:** `src/components/image-caption-generator/CaptionNextStepsPanel.tsx`

**Features:**
- Dismissible via sessionStorage (key: `"tier5c-image-caption-generator-next-steps"`)
- Shows when `activeCaptions.length > 0`
- Displays caption count (selected or all)
- "Send to Social Auto-Poster" button with proper disabled states

### Social Auto-Poster Handoff

**Payload Builder:** `src/lib/apps/image-caption-generator/handoff-builder.ts`

**Payload Schema:**
```typescript
{
  type: "social_auto_poster_import";
  sourceApp: "ai-image-caption-generator";
  captions: Array<{
    platform: string;
    caption: string;
    hashtags?: string[];
    goal?: string | null;
  }>;
  meta: {
    sourceApp: "ai-image-caption-generator";
    createdAt: number;
  };
}
```

**Safety Rules:**
- **Additive Import Only**: Never overwrites existing drafts
- **Duplicate-Safe**: Receiver checks platform + normalized caption text
- **Review-First**: No auto-posting; captions go to queue for review
- **Tenant-Safe**: All operations are user-scoped (via session auth)

**Navigation:**
- Encodes payload to base64url for URL parameter
- Falls back to localStorage if payload exceeds 1500 chars
- Navigates to `/apps/social-auto-poster/composer?handoff=...` or `?handoffId=...`
- Toast: "Prepared X captions for Social Auto-Poster"

**Receiver:** Social Auto-Poster composer page automatically imports on load
- Uses `parseSocialAutoPosterHandoff()` from `src/lib/apps/social-auto-poster/handoff-parser.ts`
- Checks for duplicates before importing
- Toast: "Imported X captions (Skipped Y duplicates)"

## Technical Architecture

### Component Structure

```
src/app/apps/image-caption-generator/
├── page.tsx                              # Main page component
└── types.ts                               # Type definitions

src/lib/apps/image-caption-generator/
├── getActiveCaptions.ts                  # Canonical selector
├── caption-mapper.ts                     # API → CaptionItem mapping
├── caption-export-formatters.ts          # Export format functions
└── handoff-builder.ts                    # Social Auto-Poster payload builder

src/components/image-caption-generator/
├── CaptionCard.tsx                       # Individual caption card
├── CaptionExportCenterPanel.tsx          # Export Center
└── CaptionNextStepsPanel.tsx             # Tier 5C ecosystem panel
```

### Key Functions

**State Management:**
- `getActiveCaptions(generatedCaptions, editedCaptions)`: Canonical selector
- `mapCaptionsToItems(captions)`: API → CaptionItem mapping

**Export Formatters:**
- `formatCaptionsPlain(captions)`: Plain text format
- `formatCaptionsCsv(captions)`: CSV format
- `pickSelectedCaptions(activeCaptions, selectedIds)`: Selection filter

**Handoff:**
- `buildSocialAutoPosterHandoff(captions)`: Payload builder
- `encodeHandoffPayload(payload)`: Base64url encoding

## Safety & Compatibility

### No Breaking Changes
- All features are additive and backward compatible
- Existing API endpoints unchanged
- No database schema changes

### Client-Side Only
- All editing and export operations are client-side
- No server-side state management
- localStorage used only for handoff (temporary)

### Tenant Safety
- All operations respect user isolation
- No cross-user data access
- User-scoped via session auth in all API calls

### Mobile Safety
- Sticky action bar with safe-area padding
- Accordion sections optimized for mobile
- Touch-friendly button sizes and spacing

## Audit Checklist

### Build & Type Safety
- ✅ `pnpm run typecheck` passed
- ✅ `pnpm run lint` passed (no errors in modified files)
- ✅ `pnpm run vercel-build` passed

### State Management
- ✅ Canonical state via `getActiveCaptions()` used consistently
- ✅ Stable IDs (string UUIDs) for all captions
- ✅ No array index as keys

### UX Standards
- ✅ Disabled-not-hidden buttons with tooltips
- ✅ Mobile-safe sticky bar with safe-area padding
- ✅ Accordion sections with live summaries
- ✅ Toast notifications for all user actions

### Handoff Safety
- ✅ Additive import only (no overwrites)
- ✅ Duplicate detection (platform + normalized text)
- ✅ Review-first (no auto-posting)
- ✅ Tenant-safe (user-scoped operations)
- ✅ Handoff guard prevents double imports

### Export Formats
- ✅ Plain text with platform grouping
- ✅ CSV with proper escaping
- ✅ Copy and download actions for all formats

## Ready for Maintenance Mode

✅ **All Tier 4, Tier 5A, and Tier 5C requirements implemented**
✅ **Production-ready with comprehensive error handling**
✅ **Fully documented with clear architecture**
✅ **Audit checklist passed**
✅ **No breaking changes; fully backward compatible**

