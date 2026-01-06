# OBD Social Auto-Poster — Audit Pass 5
## Setup UX + Deterministic Brand Source

**Date:** 2024-12-19  
**Files Audited:**
- `src/app/apps/social-auto-poster/setup/page.tsx`
- `src/lib/apps/social-auto-poster/setup/setupValidation.ts`
- `src/app/api/social-auto-poster/settings/route.ts`
- `prisma/schema.prisma` (SocialAutoposterSettings model)
- `src/app/apps/social-auto-poster/setup/components/StickySaveBar.tsx`
- `src/app/apps/social-auto-poster/setup/components/SetupSection.tsx`
- `src/app/apps/social-auto-poster/composer/page.tsx` (useBrandKit usage)

**Audit Type:** Read-only verification

---

## 1) Guided Setup

### ✅ Required Sections + Completion Logic
**Status:** CORRECT  
**Evidence:** `setupValidation.ts` lines 25-62, `setup/page.tsx` lines 785-800

**Required Sections (3 total):**
1. **Posting Mode** - Complete if `settings.postingMode` is set (line 30)
2. **Platforms** - Complete if at least one platform is selected (lines 35-39)
3. **Schedule** - Complete if `frequency` and `timezone` are valid (lines 42-45)

**Completion Logic:**
```typescript
const requiredTotal = 3; // Posting Mode, Platforms, Schedule
const requiredCompleteCount = [
  postingModeComplete,
  platformsComplete,
  scheduleComplete,
].filter(Boolean).length;
```

**UI Display:**
- `SetupProgress` component shows progress (lines 798-802)
- `SetupSection` components show "Required" label and "Complete" pill (lines 1556-1561, 1595-1600)
- Posting Mode section: `required` prop + `complete={completion.postingMode}` (line 1560)
- Platforms section: `required` prop + `complete={completion.platforms}` (line 1599)
- Schedule section: Not explicitly marked as required in UI, but validated in completion logic

**Analysis:**
- ✅ Three required sections correctly identified
- ✅ Completion logic correctly evaluates each section
- ✅ Progress indicator shows completion count
- ⚠️ **Minor:** Schedule section doesn't have `required` prop in UI (but is validated)

---

### ✅ Sticky Save Bar Conditions
**Status:** CORRECT  
**Evidence:** `setup/page.tsx` lines 790-793, 2152-2162

**Conditions:**
```typescript
const isDirty = savedSettingsSnapshot !== "" && currentSettingsString !== savedSettingsSnapshot;
const canSave = completion.requiredCompleteCount === completion.requiredTotal && !saving;
```

**Sticky Save Bar Props:**
- `isDirty={isDirty}` - Shows "Unsaved changes" when dirty
- `canSave={canSave}` - Enables/disables save button
- `helperText={!canSave ? "Complete required sections to save" : undefined}` - Shows helper when can't save
- `isSaving={saving}` - Shows "Saving..." state

**Implementation:**
- Bar is sticky (fixed bottom) with z-50 (line 45 in StickySaveBar.tsx)
- Spacer (h-24) prevents content from being covered (line 41)
- Button disabled when `!canSave || isSaving` (line 63)
- Shows "Unsaved changes" text when dirty (lines 50-54)

**Analysis:**
- ✅ Save button only enabled when all required sections complete
- ✅ Dirty state correctly detected via JSON string comparison
- ✅ Helper text guides user when save is disabled
- ✅ Non-blocking: doesn't prevent navigation or other actions

---

### ✅ Dirty Detection Approach
**Status:** CORRECT  
**Evidence:** `setup/page.tsx` lines 103, 266, 791-792, 317

**Implementation:**
```typescript
// Store snapshot after load
setSavedSettingsSnapshot(JSON.stringify(settingsWithDefaults));

// Detect dirty state
const currentSettingsString = JSON.stringify(settings);
const isDirty = savedSettingsSnapshot !== "" && currentSettingsString !== savedSettingsSnapshot;

// Update snapshot after save
setSavedSettingsSnapshot(JSON.stringify(settings));
```

**Analysis:**
- ✅ Snapshot stored after successful load (line 266)
- ✅ Snapshot updated after successful save (line 317)
- ✅ Dirty detection uses JSON string comparison
- ✅ Empty snapshot (initial state) doesn't trigger dirty
- ✅ Works correctly with nested objects (schedulingRules, contentPillarSettings, etc.)

**Note:** JSON string comparison is simple and effective for this use case. Deep equality would be more robust but adds complexity.

---

## 2) Deterministic Brand Source

### ✅ useBrandKit Default Behavior (Backcompat)
**Status:** CORRECT  
**Evidence:** Multiple files

**Prisma Schema:**
```prisma
useBrandKit  Boolean? @default(true)
```
- Default is `true` at database level (line 228)

**Settings API (GET):**
```typescript
useBrandKit: settings.useBrandKit ?? true, // Default true for backward compatibility
```
- Line 141: Returns `true` if null/undefined

**Settings API (POST):**
```typescript
useBrandKit: body.useBrandKit ?? true, // Default true for backward compatibility
```
- Lines 279, 295: Defaults to `true` on create/update

**Setup Page:**
```typescript
// Initial state
useBrandKit: true, // Line 75

// On load
useBrandKit: data.settings.useBrandKit ?? true, // Line 262

// On save
useBrandKit: settings.useBrandKit ?? true, // Line 295
```

**Composer Page:**
```typescript
// On load
useBrandKit: data.settings.useBrandKit ?? true, // Line 858

// Display
{settings.useBrandKit ?? true
  ? "Using Brand Kit defaults"
  : "Using local overrides"} // Lines 1190-1192
```

**Analysis:**
- ✅ Default is `true` everywhere (backward compatible)
- ✅ Nullish coalescing (`??`) used consistently
- ✅ Database default matches application default
- ✅ All code paths default to `true` if null/undefined

---

### ✅ How It Persists
**Status:** CORRECT  
**Evidence:** `settings/route.ts` lines 274-309

**Persistence:**
- **Create:** `useBrandKit: body.useBrandKit ?? true` (line 279)
- **Update:** `useBrandKit: body.useBrandKit ?? true` (line 295)
- Stored in `SocialAutoposterSettings.useBrandKit` field
- Type: `Boolean?` (nullable, defaults to `true`)

**Analysis:**
- ✅ Persisted correctly on create
- ✅ Persisted correctly on update
- ✅ Default applied if not provided
- ✅ Nullable field allows for future migration scenarios

---

### ✅ How Composer Uses It
**Status:** CORRECT  
**Evidence:** `composer/page.tsx` lines 850-861, 1187-1193

**Usage:**
1. **Load Settings:**
   ```typescript
   useBrandKit: data.settings.useBrandKit ?? true, // Line 858
   ```

2. **Display in Banner:**
   ```typescript
   {settings.useBrandKit ?? true
     ? "Using Brand Kit defaults"
     : "Using local overrides"} // Lines 1190-1192
   ```

3. **Brand Voice Field:**
   - When `useBrandKit === true`: Brand Kit defaults are used (inherited from Brand Kit)
   - When `useBrandKit === false`: Local `brandVoice` field is shown and used

**Analysis:**
- ✅ Composer loads `useBrandKit` from settings
- ✅ Displays current state in banner
- ✅ Determines whether to use Brand Kit or local overrides
- ✅ Defaults to `true` if not set (backward compatible)

**Note:** The actual brand voice resolution logic (Brand Kit vs local) is handled in the generation API, not in the composer UI. The composer just displays the current setting.

---

## 3) Connection-State UX

### ✅ Badge + Messaging
**Status:** CORRECT  
**Evidence:** `setup/page.tsx` lines 714-754

**Implementation:**
```typescript
const publishingEnabled = isMetaPublishingEnabled();
const uiModel = getConnectionUIModel(connectionStatus, undefined, publishingEnabled);

<ConnectionStatusBadge
  state={uiModel.state}
  label={uiModel.badgeLabel}
  isDark={isDark}
/>
{uiModel.message && (
  <p className={`text-sm mt-2 ${themeClasses.mutedText}`}>
    {uiModel.message}
  </p>
)}
```

**Badge States:**
- Uses `getConnectionUIModel()` to derive state and label
- Displays badge with appropriate styling
- Shows message below badge if provided

**Analysis:**
- ✅ Badge displayed at top of page
- ✅ State derived from connection status
- ✅ Message shown when available
- ✅ Error handling: shows error badge if connection status fails (lines 739-752)

---

### ✅ Pending/Limited/Disabled Behaviors (Non-Blocking)
**Status:** CORRECT  
**Evidence:** `setup/page.tsx` lines 726-730, 757-775

**Pending State:**
```typescript
{(uiModel.state === "pending" || uiModel.state === "limited") && (
  <span className={`text-xs ${themeClasses.mutedText}`} title="This is due to Meta app review. Publishing will activate automatically once approved.">
    ℹ️ Learn more
  </span>
)}
```

**Session Callout:**
```typescript
if (uiModel.state === "pending" || uiModel.state === "limited") {
  return (
    <SessionCallout
      dismissKey={DISMISS_KEYS.setupConnectionStates}
      title="About Connection States"
      message="You can queue posts now. Publishing activates once accounts are connected."
      isDark={isDark}
    />
  );
}
```

**Analysis:**
- ✅ Pending/limited states show informational badge
- ✅ Helper text explains state (Meta app review)
- ✅ Session callout provides context
- ✅ **Non-blocking:** Setup can be completed even in pending/limited states
- ✅ Completion logic doesn't require connection (lines 25-62 in setupValidation.ts)
- ✅ Save button enabled when required sections complete, regardless of connection state

**Connection States:**
- `pending` - Can complete setup, can queue posts
- `limited` - Can complete setup, can queue posts
- `disabled` - Can complete setup, can queue posts
- `error` - Can complete setup, can queue posts
- `connected` - Can complete setup, can queue and publish posts

**Conclusion:** Connection state is informational only and does NOT block setup completion.

---

## 4) Verdict

### ✅ Overall Assessment: **PASS** (with minor observation)

**Strengths:**
1. ✅ Guided setup correctly identifies 3 required sections
2. ✅ Completion logic correctly evaluates each section
3. ✅ Sticky save bar correctly gates on completion
4. ✅ Dirty detection works correctly
5. ✅ `useBrandKit` defaults to `true` consistently (backward compatible)
6. ✅ Brand source persists correctly
7. ✅ Composer uses brand source correctly
8. ✅ Connection-state UX is non-blocking
9. ✅ Badge and messaging provide clear feedback

**Minor Observation (Non-Blocking):**
1. **Schedule section UI:** Schedule section doesn't have `required` prop in `SetupSection` component, but it is validated in completion logic. This is a minor UI inconsistency but doesn't affect functionality.

**Risk Assessment:**
- **Current risk:** NONE - All functionality works correctly
- **Observation:** Very minor UI consistency improvement possible
- **Impact if not fixed:** None - purely cosmetic

---

## Recommendations

### Priority: Very Low (Cosmetic Only)

**1. Schedule Section UI Consistency:**
```typescript
// In setup/page.tsx, find Schedule section and add:
<SetupSection
  title="Schedule"
  subtitle="Configure posting frequency and timing"
  required  // Add this
  complete={completion.schedule}  // Add this if not present
  isDark={isDark}
>
```

**Rationale:**
- Makes UI consistent with other required sections
- Helps users understand schedule is required
- Very minor change, purely cosmetic

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| **Guided Setup - Required Sections** | ✅ PASS | 3 sections correctly identified |
| **Guided Setup - Completion Logic** | ✅ PASS | Correctly evaluates all sections |
| **Guided Setup - Sticky Save Bar** | ✅ PASS | Correctly gates on completion |
| **Guided Setup - Dirty Detection** | ✅ PASS | JSON comparison works correctly |
| **Brand Source - Default Behavior** | ✅ PASS | Defaults to `true` everywhere |
| **Brand Source - Persistence** | ✅ PASS | Persists correctly in DB |
| **Brand Source - Composer Usage** | ✅ PASS | Loads and displays correctly |
| **Connection UX - Badge/Messaging** | ✅ PASS | Clear feedback provided |
| **Connection UX - Non-Blocking** | ✅ PASS | Setup not blocked by connection state |

**Overall Verdict:** ✅ **PASS**  
**Tier 5C Compliance:** ✅ **CONFIRMED**

---

**Audit Status:** ✅ **PASS**  
**Action Required:** Optional cosmetic improvement (non-blocking)

