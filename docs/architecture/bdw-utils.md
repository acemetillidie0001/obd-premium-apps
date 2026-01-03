# BDW Shared Utilities

Shared utilities for the AI Business Description Writer (BDW) app. These utilities are designed to be reusable across OBD apps and follow deterministic, client-side patterns.

**Location:** `src/lib/utils/`

---

## safeTrimToLimit

**File:** `src/lib/utils/safeTrimToLimit.ts`

**Purpose:** Deterministic text trimming that respects sentence and word boundaries, removes trailing artifacts, and ensures clean output.

**Function:**
```typescript
safeTrimToLimit(text: string, maxChars: number): string
```

**Behavior:**
- Returns text unchanged if `<= maxChars`
- Prefers trimming at sentence boundary (within last 60 chars)
- Otherwise trims at word boundary
- Never cuts mid-word
- Collapses extra whitespace
- Removes trailing artifacts (dangling commas, double spaces, trailing punctuation)
- Ensures result length `<= maxChars`

**Where Used:**
- `bdw-fix-packs.ts`: Used in multiple fix pack transformations
  - Meta optimization (160 char limit)
  - Length trimming for various output fields (300, 400, 750, 800 char limits)
  - Ensures all trimmed content respects sentence boundaries

**Reusability:** Can be used by any app that needs safe text truncation with boundary respect.

---

## bdw-export-formatters

**File:** `src/lib/utils/bdw-export-formatters.ts`

**Purpose:** Formats generated BDW content into various export formats (plain text, markdown, HTML).

**Formats Available:**

### Full Pack Formatters
- `formatFullPackPlainText()`: Complete marketing pack as plain text
- `formatFullPackMarkdown()`: Complete marketing pack as markdown

### Bundle Formatters (Used by Copy Bundles)
- `formatGBPPackPlainText()`: Google Business Profile bundle (GBP + Meta + Taglines + Elevator Pitch)
- `formatWebsitePackPlainText()`: Website bundle (Website About + Taglines + Elevator Pitch)

### Block Formatters (Used by Export Center)
- `formatGBPBlock()`: GBP block (GBP + Meta + Taglines + Elevator Pitch)
- `formatWebsiteAboutBlock()`: Website About block
- `formatSocialBioBlock()`: Social Bio block (Facebook, Instagram, X, LinkedIn)
- `formatFAQBlock()`: FAQ block (formatted Q&A pairs)
- `formatMetaBlock()`: Meta Description block

### HTML Formatters
- `formatWebsiteHtmlSnippet()`: Website About content as HTML snippet (`<section class="about-us">` with `<p>` tags)

**Where Used:**
- **Export Center**: Uses all block formatters for copy/download operations
- **Copy Bundles**: Uses `formatGBPPackPlainText()`, `formatWebsitePackPlainText()`, `formatFullPackPlainText()`

**Interface:**
```typescript
interface BusinessDescriptionResponse {
  obdListingDescription: string;
  websiteAboutUs: string;
  googleBusinessDescription: string;
  socialBioPack: {
    facebookBio: string;
    instagramBio: string;
    xBio: string;
    linkedinTagline: string;
  };
  taglineOptions: string[];
  elevatorPitch: string;
  faqSuggestions: Array<{ question: string; answer: string }>;
  metaDescription: string | null;
}
```

**Reusability:** Can be adapted for other content generation apps that need multi-format export capabilities.

---

## bdw-fix-packs

**File:** `src/lib/utils/bdw-fix-packs.ts`

**Purpose:** Client-side transformation suggestions for BDW outputs based on health check findings. Provides previews and safe edits. No API calls, no DB writes, no side effects.

**Key Functions:**

### Eligibility Checking
- `getEligibleFixPacks(healthReport, formValues, result)`: Returns array of eligible fix packs based on health check findings
- Each fix pack has eligibility logic that checks if the fix would make meaningful changes
- No-op prevention: Fixes that would make no changes are filtered out

### Proposed Changes Computation
- `generateFixPreview(fixId, healthReport, formValues, result)`: Generates preview of proposed changes
- Returns `FixPreview` with:
  - `updated`: Partial result object with proposed changes
  - `notes`: Array of descriptive notes about what changed

**Fix Pack Types:**
- `add_location`: Adds city/state references to descriptions missing location
- `trim_length`: Optimizes descriptions exceeding character limits (uses `safeTrimToLimit`)
- `service_mention`: Adds key services to descriptions
- `safer_claims`: Replaces risky phrases with trustworthy alternatives
- `meta_optimize`: Improves meta description for SEO and length (uses `safeTrimToLimit`)

**Where Used:**
- `src/components/bdw/FixPacks.tsx`: Uses eligibility checking and preview generation
- `src/app/apps/business-description-writer/page.tsx`: Integrates fix pack previews into workflow

**Reusability:** Pattern can be reused for other apps that need deterministic, previewable transformations based on analysis results.

---

## bdw-quality-controls

**File:** `src/lib/utils/bdw-quality-controls.ts`

**Purpose:** Provides deterministic analysis functions for quality checks and safe fix generators.

### Analyzers

**`runQualityAnalysis(result, services, keywords)`**: Runs all quality checks and returns analysis report

**Quality Metrics:**
- **Hype Words Detection**: Identifies overly promotional language
  - Returns: `HypeWordsResult[]` with section, count, and detected words
- **Repetition Detection**: Finds duplicate sentences/phrases
  - Returns: `RepetitionResult[]` with section, count, and duplicate sentences
- **Keyword Repetition Analysis**: Tracks keyword overuse across sections
  - Returns: `KeywordRepetitionResult[]` with keyword, counts per section, and warnings
- **Readability Estimate**: Calculates average words per sentence and complexity band
  - Returns: `ReadabilityResult[]` with section, metrics, and complexity band ("Easy" | "Standard" | "Complex")

### Fix Generators

**`generateSoftenHypeWordsFix(result, analysis)`**: Generates proposed changes to soften hype words
- Returns: `Partial<BusinessDescriptionResponse>` with softened language
- Uses deterministic replacement rules (no AI calls)

**`generateRemoveDuplicatesFix(result, analysis)`**: Generates proposed changes to remove duplicate sentences
- Returns: `Partial<BusinessDescriptionResponse>` with duplicates removed
- Preserves first occurrence, removes subsequent duplicates

**Where Used:**
- `src/app/apps/business-description-writer/page.tsx`: Quality Controls tab uses analysis and fix generators
- Fix generators open preview modal (no auto-apply)

**Reusability:** Analysis patterns can be reused for other content quality checks. Fix generators follow the same previewable transformation pattern as fix packs.

---

## bdw-brand-profile

**File:** `src/lib/utils/bdw-brand-profile.ts`

**Purpose:** Handles localStorage persistence of brand profile settings (brand voice, personality style, writing preferences).

**Interface:**
```typescript
interface BrandProfile {
  brandVoice: string;
  targetAudience: string;
  uniqueSellingPoints: string;
  services: string;
  city: string;
  state: string;
}
```

**Functions:**
- `saveBrandProfile(businessName, profile)`: Saves profile to localStorage (keyed by normalized business name)
- `loadBrandProfile(businessName)`: Loads profile from localStorage
- `deleteBrandProfile(businessName)`: Deletes profile from localStorage
- `listBrandProfiles()`: Returns array of all saved profile business names

**Storage Pattern:**
- Uses prefix: `bdw-brand-profile-{normalizedBusinessName}`
- Business names are normalized (trimmed, lowercased) for consistent keys
- Gracefully handles localStorage unavailability (SSR-safe)

**Where Used:**
- `src/components/bdw/BrandProfilePanel.tsx`: Uses all functions for preset management
- `src/app/apps/business-description-writer/page.tsx`: Applies profiles to form with fill-empty-only or overwrite modes

**Reusability:** Pattern can be reused for any app that needs localStorage-based preset/profile management.

---

## Design Patterns

### Deterministic Transformations
All fix packs and quality controls use rule-based transformations:
- No AI calls in transformations
- All changes are predictable and previewable
- Character count changes are calculated deterministically
- Safe sentence-boundary truncation via `safeTrimToLimit`

### Preview-First Workflow
- All fixes generate previews before applying
- User must explicitly approve changes
- Original result never mutated
- Changes stored in separate `editedResult` state

### Client-Side Only
- All utilities run entirely client-side
- No API calls for transformations
- No database writes from utilities
- Fast execution, predictable results

---

## Future Reusability

These utilities demonstrate patterns that can be adapted for other OBD apps:

1. **Safe Text Trimming**: `safeTrimToLimit` pattern for any app that needs character limit enforcement
2. **Multi-Format Export**: `bdw-export-formatters` pattern for apps generating content in multiple formats
3. **Previewable Transformations**: `bdw-fix-packs` pattern for apps that need deterministic, previewable edits
4. **Quality Analysis**: `bdw-quality-controls` pattern for apps that need content quality metrics
5. **localStorage Presets**: `bdw-brand-profile` pattern for apps that need client-side preset management

---

## Related Documentation

- [Business Description Writer V5 App Documentation](../apps/business-description-writer-v5.md)
- [Business Description Writer V3+ UX Upgrade Release Notes](../releases/business-description-writer-v3-ux-upgrade.md)

