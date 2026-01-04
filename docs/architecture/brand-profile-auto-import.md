# Brand Profile Auto-Import Architecture

## Purpose

The Brand Profile serves as the **single source of identity** for all OBD apps. The auto-import system automatically hydrates app forms with brand data, ensuring consistency across all tools while respecting user intent and preventing data loss.

## Core Rules

### Tenant-Safe Design
- **No server calls during auto-import**: Brand profile loads from `localStorage` cache first (fast path)
- **Fallback to API**: If cache miss, fetches from `/api/brand-profile` and caches response
- **Client-side only**: All merge logic runs in the browser; no server-side state mutation
- **Business-scoped caching**: localStorage keys scoped by businessId (`obd.brandProfile.v1.<businessId>`) for tenant isolation
- **Legacy migration**: Automatic migration from legacy global cache (`obd.brandProfile.v1`) to business-scoped cache when businessId becomes available

### Fill-Empty-Only Default
- **Default behavior**: Auto-import uses `fill-empty-only` mode
- **Never overwrite**: Fields with existing values are preserved
- **Empty detection**: Treats `undefined`, `null`, empty string, and whitespace-only strings as empty

### Opt-In Toggle
- **User control**: Each app provides a toggle to enable/disable auto-import
- **Per-app storage**: Toggle state persisted per app (e.g., `obd.acw.useBrandProfile`)
- **Per-page-load execution**: Auto-import runs once per page load (or per session, configurable)

## Hook API

### `useAutoApplyBrandProfile`

React hook that automatically loads and applies brand profile data to form state.

#### Signature

```typescript
function useAutoApplyBrandProfile<T extends Record<string, unknown>>(
  args: UseAutoApplyBrandProfileArgs<T>
): UseAutoApplyBrandProfileResult

interface UseAutoApplyBrandProfileArgs<T> {
  enabled?: boolean;              // Whether auto-apply is enabled (default: true)
  form: T;                        // Current form state
  setForm: (form: T | ((prev: T) => T)) => void;  // Form state setter
  map: FieldMapper<T>;            // Field mapping (Record or callback)
  storageKey: string;             // Unique key for tracking execution
  fillEmptyOnly?: boolean;        // Merge mode (default: true)
  once?: "per-page-load" | "per-session";  // Execution frequency (default: "per-page-load")
  businessId?: string;            // Optional business ID to scope the storage key
}

interface UseAutoApplyBrandProfileResult {
  applied: boolean;      // Whether brand profile was successfully applied
  brandFound: boolean;   // Whether a brand profile was found and loaded
}
```

#### Usage Examples

**Example 1: Record-based mapping (simplest)**

```typescript
import { useAutoApplyBrandProfile } from "@/lib/brand/useAutoApplyBrandProfile";
import { type BrandProfile } from "@/lib/brand/brand-profile-types";

const brandProfileMap: Record<string, keyof BrandProfile> = {
  businessName: "businessName",
  businessType: "businessType",
  city: "city",
  state: "state",
  brandVoice: "brandVoice",
  targetAudience: "targetAudience",
};

const { applied, brandFound } = useAutoApplyBrandProfile({
  enabled: useBrandProfileToggle,
  form: formValues,
  setForm: setFormValues,
  map: brandProfileMap,
  storageKey: "content-writer-page",
  fillEmptyOnly: true,
  once: "per-page-load",
});
```

**Example 2: Callback-based mapping (flexible)**

```typescript
const brandProfileMap = (
  formKey: keyof ImageCaptionRequest,
  brand: BrandProfile
): keyof BrandProfile | undefined => {
  if (formKey === "businessName") return "businessName";
  if (formKey === "businessType") return "businessType";
  if (formKey === "city") return "city";
  if (formKey === "state") return "state";
  if (formKey === "brandVoice") return "brandVoice";
  if (formKey === "hashtagStyle") return "hashtagStyle";
  return undefined;
};

const { applied, brandFound } = useAutoApplyBrandProfile({
  enabled: true,
  form: form,
  setForm: setForm,
  map: brandProfileMap,
  storageKey: "image-caption-generator-page",
});
```

## Mapping Strategy

### Per-App Mapping Objects

Each app defines its own mapping between form fields and Brand Profile fields. This allows:
- **Field name flexibility**: App forms can use different field names (e.g., `companyName` vs `businessName`)
- **Selective mapping**: Only map fields that are relevant to the app
- **Type safety**: TypeScript ensures mapping correctness

### Mapping Patterns

**Pattern 1: Direct 1:1 mapping (Record)**
```typescript
const brandProfileMap: Record<string, keyof BrandProfile> = {
  businessName: "businessName",
  brandVoice: "brandVoice",
  city: "city",
};
```

**Pattern 2: Renamed fields (Callback)**
```typescript
const brandProfileMap = (formKey: string, brand: BrandProfile) => {
  if (formKey === "companyName") return "businessName";
  if (formKey === "location") return "city";
  return undefined;
};
```

**Pattern 3: Complex mapping (Callback with logic)**
```typescript
const brandProfileMap = (formKey: keyof FormType, brand: BrandProfile) => {
  if (formKey === "tone") return "toneNotes";  // Map tone → toneNotes
  if (formKey === "keywords") return "industryKeywords";
  // Skip unmapped fields
  return undefined;
};
```

### Current App Mappings

| App | Mapping Type | Key Fields |
|-----|-------------|------------|
| Content Writer | Record | `businessName`, `businessType`, `city`, `state`, `brandVoice`, `targetAudience`, `keywords` → `industryKeywords`, `language` |
| Social Media Post Creator | Callback | `businessName`, `businessType`, `brandVoice`, `hashtagStyle` |
| Image Caption Generator | Callback | `businessName`, `businessType`, `city`, `state`, `brandVoice`, `hashtagStyle`, `includeHashtags`, `variationMode`, `language` |
| Review Responder | Callback | `businessName`, `businessType`, `city`, `state`, `brandVoice`, `language` |
| FAQ Generator | Callback | `businessName`, `businessType`, `brandVoice`, `tone` → `toneNotes` |

## Merge Engine

### `applyBrandProfileToForm`

Low-level utility function that performs the actual merge operation.

```typescript
function applyBrandProfileToForm<T extends Record<string, unknown>>(
  args: ApplyBrandProfileArgs<T>
): T

interface ApplyBrandProfileArgs<T> {
  form: T;
  brand: BrandProfile;
  map: FieldMapper<T>;
  mode?: "fill-empty-only" | "overwrite";  // default: "fill-empty-only"
}
```

### Merge Modes

- **`fill-empty-only`** (default): Only fills empty form fields; preserves existing values
- **`overwrite`**: Replaces all mapped fields with brand profile values

### Empty Detection

A value is considered "empty" if it is:
- `undefined`
- `null`
- Empty string `""`
- Whitespace-only string `"   "`

**Note**: Boolean values (including `false`) are never considered empty.

## Regression Checklist

When testing Brand Profile auto-import, verify:

### 1. Save Brand Profile
- [ ] Create/edit Brand Profile at `/apps/brand-profile`
- [ ] Save profile successfully
- [ ] Profile persists after page reload

### 2. Auto-Populate Empty Fields
- [ ] Open each app with **empty form** (or clear existing values)
- [ ] Enable "Use Brand Profile" toggle (if applicable)
- [ ] Refresh page or navigate to app
- [ ] Empty fields auto-populate from Brand Profile
- [ ] Verify correct field mapping (e.g., `keywords` → `industryKeywords`)

### 3. Never Overwrite Existing Values
- [ ] Open app with **pre-filled form fields**
- [ ] Enable auto-import
- [ ] Refresh page
- [ ] Pre-filled fields remain unchanged
- [ ] Only empty fields receive brand profile values

### 4. Toggle Off Stops Future Auto-Import
- [ ] Disable "Use Brand Profile" toggle
- [ ] Refresh page
- [ ] Fields do NOT auto-populate
- [ ] Toggle state persists across page reloads

### 5. Manual "Apply to Form" Respects Fill-Empty-Only
- [ ] Fill some form fields manually
- [ ] Click "Apply to form" button with "Fill empty only" checked
- [ ] Existing fields remain unchanged
- [ ] Empty fields receive brand profile values
- [ ] Uncheck "Fill empty only" and apply
- [ ] All mapped fields overwritten (if overwrite mode enabled)

### 6. Status Indicators
- [ ] "Saved Brand Profile detected." shows when `brandFound === true`
- [ ] "Applied to empty fields." shows when `applied === true`
- [ ] "Create a Brand Profile →" link shows when `brandFound === false`
- [ ] Indicators use muted text styling (no custom styles)

### 7. Toast Notification
- [ ] One-time toast shown when brand profile is successfully applied: "Brand Profile applied to empty fields."
- [ ] Toast appears only once per page load (tracked via useRef)
- [ ] Toast auto-clears after 1200ms

## Implementation Files

- **Hook**: `src/lib/brand/useAutoApplyBrandProfile.ts`
- **Merge Engine**: `src/lib/brand/applyBrandProfile.ts`
- **Storage**: `src/lib/brand/brandProfileStorage.ts`
- **Types**: `src/lib/brand/brand-profile-types.ts`
- **UI Component**: `src/components/brand/BrandProfileAutoImportPanel.tsx`

## Related Documentation

- [Brand Profile Types](../brand-profile-types.md) - Brand Profile data structure
- [OBD Framework Theme](../obd-framework/theme.md) - Styling system for indicators

