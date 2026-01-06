# OBD Social Auto-Poster — Audit Pass 3
## Composer Import Guardrails + Event Variant Safety

**Date:** 2024-12-19  
**File Audited:** `src/app/apps/social-auto-poster/composer/page.tsx`  
**Audit Type:** Read-only verification

---

## A) Guardrails Checklist

### ✅ 1. Prefill only if topic+details empty
**Status:** YES  
**Evidence:**
- **Canonical handoff handler** (lines 235-238): Checks `!currentTopic && !currentDetails` before prefilling
- **Event import handler** (lines 563-573): Checks `currentTopic || currentDetails` and returns early if content exists
- **Offer import handler** (lines 643-654): Same guardrail check before import

**Implementation:**
```typescript
const currentTopic = formData.topic?.trim() || "";
const currentDetails = formData.details?.trim() || "";

if (!currentTopic && !currentDetails) {
  // Prefill logic
}
```

---

### ✅ 2. No auto-save settings
**Status:** YES  
**Evidence:**
- **Event import** (lines 596-599): Only sets UI state via `setSettings()` - does NOT call any save API
- **Offer import** (lines 674-677): Same pattern - UI state only
- **Canonical handoff** (lines 228-232): Sets `postingMode: "campaign"` in UI state only

**Note:** Settings are only persisted when user explicitly saves in Setup page. No automatic persistence during import.

---

### ✅ 3. No auto-queue creation
**Status:** YES  
**Evidence:**
- **Caption import** (lines 396-550): Creates queue items only when user clicks "Import" button
- **Event import** (lines 552-631): Only prefills form - no queue creation
- **Offer import** (lines 633-709): Only prefills form - no queue creation
- **Canonical handoff** (lines 194-315): Only prefills form - no queue creation

**Conclusion:** All imports are additive to the composer form only. User must explicitly generate posts and add to queue.

---

### ✅ 4. No auto-posting
**Status:** YES  
**Evidence:**
- No API calls to posting endpoints in any import handler
- No automatic scheduling or publishing logic
- All imports result in draft content in the composer form only

---

### ✅ 5. Clears handoff on success import
**Status:** YES  
**Evidence:**
- **Caption import** (lines 520-538): Clears `handoffPayload`, `handoffHash`, localStorage, and URL params
- **Event import** (lines 606-621): Clears handoff state, localStorage, and URL params
- **Offer import** (lines 684-699): Clears handoff state, localStorage, and URL params
- **Canonical handoff** (lines 309-313): Clears URL params after successful import

**Implementation pattern:**
```typescript
// Clear handoff state
setHandoffPayload(null);
setHandoffHash(null);

// Clear localStorage
if (handoffId) {
  localStorage.removeItem(`obd_handoff:${handoffId}`);
}

// Clear URL params
const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
replaceUrlWithoutReload(cleanUrl);
```

---

### ✅ 6. Clears handoff on dismiss
**Status:** YES  
**Evidence:**
- **Canonical handoff banner** (lines 1098-1101): Calls `clearHandoff()` on dismiss
- **Offers builder banner** (lines 1230-1243): Clears handoff state, localStorage, and URL params
- **Event builder banner** (lines 1320-1334): Clears handoff state, localStorage, and URL params

**Note:** `clearHandoff()` function (from `social-handoff-transport.ts`) clears sessionStorage handoff envelope.

---

### ✅ 7. Handles expired handoff UX
**Status:** YES  
**Evidence:**
- **Parse result handling** (lines 207-210): Detects `result.error === "expired"` and sets `handoffExpired` state
- **Expired banner** (lines 1067-1079): Shows user-friendly banner with dismiss handler
- **Parser implementation** (`parseSocialHandoff.ts` lines 204-206): Returns `{ error: "expired" }` when TTL exceeded

**UX Flow:**
1. Parser detects expired handoff (TTL check in `readHandoff()`)
2. Sets `handoffExpired` state to `true`
3. Displays banner: "Import expired - Please resend from the source app."
4. User can dismiss banner, which calls `clearHandoff()`

---

## B) Source Behaviors

### ✅ ai-content-writer → Content Placement
**Status:** CORRECT  
**Evidence:** Lines 285-289

**Behavior:**
- Content from `ai-content-writer` goes to **`details` field** (not `topic`)
- Rationale: ACW content is longer-form, so it belongs in the details field

**Code:**
```typescript
if (result.payload.source === "ai-content-writer") {
  setFormData((prev) => ({
    ...prev,
    details: textToInsert.trim(),
  }));
}
```

---

### ✅ offers-builder → Campaign Handling
**Status:** CORRECT  
**Evidence:** Lines 633-709

**Behavior:**
- Sets `campaignType: "Limited-Time Offer"` in form data
- Sets `postingMode: "campaign"` in UI state (does NOT save)
- Builds content from `headline`, `description`, and `expirationDate`
- Places headline in `topic`, full details (with expiration) in `details`

**Code:**
```typescript
setFormData((prev) => ({
  ...prev,
  topic: topic.trim(),
  details: fullDetails.trim(),
  campaignType: "Limited-Time Offer",
}));

setSettings((prev) => ({
  ...prev,
  postingMode: "campaign",
}));
```

---

### ✅ event-campaign-builder → Campaign UI Selection + Variants
**Status:** CORRECT  
**Evidence:** Lines 552-631, 227-232, 1102-1148

**Behavior:**
1. **Campaign mode selection:** Sets `postingMode: "campaign"` in UI state (line 598, 228-232)
2. **Variant handling:** 
   - Uses first countdown variant as default (line 576)
   - Stores variants in `canonicalHandoff.countdownVariants`
   - Provides dropdown in banner for variant selection (lines 1102-1148)
3. **Content structure:** Builds event text with countdown copy + event info

**Dual Implementation Note:**
- **Legacy handler** (`handleImportEvent`, lines 552-631): Uses `handoffPayload.suggestedCountdownCopy`
- **Canonical handler** (lines 194-315): Uses `canonicalHandoff.countdownVariants`
- Both set campaign mode and handle variants correctly

---

## C) Event Variant Selector Safety

### ✅ 1. Edited Detection Rule (Exact Comparison)
**Status:** CORRECT  
**Evidence:** Lines 342-351

**Implementation:**
```typescript
const hasEditorBeenEdited = (): boolean => {
  if (!originalImportedText.current) {
    return false; // No import to compare against
  }
  const currentTopic = formData.topic?.trim() || "";
  const currentDetails = formData.details?.trim() || "";
  const currentText = currentTopic + (currentDetails ? "\n\n" + currentDetails : "");
  const originalText = originalImportedText.current || "";
  return currentText.trim() !== originalText.trim();
};
```

**Analysis:**
- ✅ Uses exact string comparison (`!==`)
- ✅ Trims both sides before comparison
- ✅ Handles empty fields correctly
- ✅ Stores original imported text in `originalImportedText.current` (line 282)

---

### ✅ 2. When Dropdown is Disabled
**Status:** CORRECT  
**Evidence:** Line 1120

**Implementation:**
```typescript
disabled={hasEditorBeenEdited()}
```

**Behavior:**
- Dropdown is disabled when `hasEditorBeenEdited()` returns `true`
- This prevents variant switching after user edits

---

### ✅ 3. When Tooltip Shows and Text Used
**Status:** CORRECT  
**Evidence:** Lines 1121, 1139-1145

**Implementation:**
```typescript
title={hasEditorBeenEdited() ? "Variant selection is disabled after edits to protect your changes." : undefined}
```

**Tooltip Text:** "Variant selection is disabled after edits to protect your changes."

**Additional UX:**
- Shows explanatory text below dropdown when disabled (lines 1139-1145):
  ```typescript
  {hasEditorBeenEdited() && (
    <p className={`text-xs mt-1 ...`}>
      Variant selection is disabled after edits to protect your changes.
    </p>
  )}
  ```

---

### ✅ 4. Confirm "Never Overwrite Edits"
**Status:** CONFIRMED  
**Evidence:** Lines 353-392

**Implementation:**
```typescript
const handleVariantChange = (variantIndex: number) => {
  // ... validation ...
  
  // Check if current editor content matches original imported text
  const currentText = currentTopic + (currentDetails ? "\n\n" + currentDetails : "");
  const originalText = originalImportedText.current || "";

  // Only update if content matches (user hasn't edited)
  if (currentText.trim() === originalText.trim()) {
    // Update variant
  }
  // If content doesn't match, silently do nothing (user has edited)
};
```

**Safety Guarantees:**
- ✅ Only updates if current content exactly matches original
- ✅ If user has edited, function returns early (silent no-op)
- ✅ Never overwrites user edits
- ✅ Updates `originalImportedText.current` after successful variant switch (line 372) to track new baseline

---

## D) Drift/Duplication Risks

### ⚠️ Risk 1: Dual Event Import Handlers
**Status:** LOW RISK (but noted)

**Observation:**
- **Legacy handler:** `handleImportEvent()` (lines 552-631) - uses `handoffPayload` from `parseSocialAutoPosterHandoff()`
- **Canonical handler:** `useEffect` (lines 194-315) - uses `canonicalHandoff` from `parseSocialHandoff()`

**Analysis:**
- Both handlers check for empty composer before importing (guardrail ✅)
- Both set campaign mode correctly
- Both handle countdown variants
- **Potential issue:** If both handoff types are present, both could attempt import (though guardrails prevent overwrite)

**Mitigation:**
- `handoffProcessed.current` flag prevents multiple legacy imports
- `canonicalHandoffProcessed.current` flag prevents multiple canonical imports
- Empty composer check prevents overwrite
- **Recommendation:** Monitor for edge cases where both handoff types arrive simultaneously

---

### ✅ Risk 2: Variant State Management
**Status:** SAFE

**Observation:**
- `selectedCountdownIndex` state (line 136) tracks current variant
- `originalImportedText.current` tracks baseline for edit detection
- Both are updated consistently in `handleVariantChange()`

**Analysis:**
- ✅ State updates are atomic
- ✅ Edit detection uses stored baseline correctly
- ✅ No race conditions observed

---

### ✅ Risk 3: Handoff Cleanup Completeness
**Status:** SAFE

**Observation:**
- Multiple cleanup paths: success, dismiss, expired
- Cleanup includes: state, localStorage, URL params, sessionStorage

**Analysis:**
- ✅ All cleanup paths are consistent
- ✅ `clearHandoff()` handles sessionStorage cleanup
- ✅ Manual cleanup handles localStorage and URL params
- ✅ No orphaned handoff data observed

---

### ⚠️ Risk 4: Legacy vs Canonical Handoff Overlap
**Status:** LOW RISK (documented)

**Observation:**
- Two parsing systems:
  1. `parseSocialAutoPosterHandoff()` - legacy URL-based
  2. `parseSocialHandoff()` - canonical sessionStorage-based

**Analysis:**
- Both systems have separate state tracking (`handoffProcessed` vs `canonicalHandoffProcessed`)
- Both respect empty composer guardrail
- **Potential edge case:** If legacy handoff arrives after canonical, it could still import (though unlikely in practice)

**Mitigation:**
- Guardrails prevent overwrite
- Both systems clear handoff after use
- **Recommendation:** Consider deprecating legacy handler once all sources migrate to canonical format

---

## Summary

### ✅ All Guardrails Pass
- Prefill only if empty: ✅
- No auto-save: ✅
- No auto-queue: ✅
- No auto-posting: ✅
- Clears on success: ✅
- Clears on dismiss: ✅
- Expired UX: ✅

### ✅ Source Behaviors Correct
- ai-content-writer → details: ✅
- offers-builder → campaign: ✅
- event-campaign-builder → campaign + variants: ✅

### ✅ Event Variant Safety Confirmed
- Exact comparison: ✅
- Disabled when edited: ✅
- Tooltip text: ✅
- Never overwrites edits: ✅

### ⚠️ Minor Risks (Non-Blocking)
- Dual event handlers (low risk, mitigated)
- Legacy vs canonical overlap (low risk, documented)

---

## Recommendations

1. **Monitor:** Watch for edge cases where both legacy and canonical handoffs arrive simultaneously
2. **Future:** Consider deprecating legacy `handleImportEvent()` once all sources use canonical format
3. **Documentation:** The dual handler pattern is intentional for backward compatibility

---

**Audit Status:** ✅ **PASS**  
**Tier 5C Compliance:** ✅ **CONFIRMED**

