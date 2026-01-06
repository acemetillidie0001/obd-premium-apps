# OBD Social Auto-Poster — Audit Pass 4
## Queue + Bulk Actions + Tenant Safety

**Date:** 2024-12-19  
**Files Audited:**
- `src/app/apps/social-auto-poster/queue/page.tsx`
- `src/lib/apps/social-auto-poster/queue/queueStatusUI.ts`
- `src/app/api/social-auto-poster/queue/delete/route.ts`
- `src/app/api/social-auto-poster/queue/approve/route.ts`

**Audit Type:** Read-only verification

---

## 1) Bulk Actions

### ✅ Selection Rules (Visible Only, Cleared on Filter Change)
**Status:** CORRECT  
**Evidence:**

**Selection State:**
- Line 91: `selectedIds` state tracks selected item IDs
- Line 351: `visibleItems = items` - items are already filtered by API call (line 253)
- Selection operates only on visible/filtered items ✅

**Cleared on Filter Change:**
- Lines 115-118: `useEffect` clears selection when filter changes
```typescript
useEffect(() => {
  loadQueue();
  // Clear selection when filter changes
  setSelectedIds(new Set());
}, [filter]);
```

**Selection Functions:**
- Lines 330-340: `toggleSelection()` - toggles individual item selection
- Lines 342-348: `toggleSelectAll()` - selects all items in `items` array (which is filtered)
- Line 715: Select all checkbox uses `items.length` (filtered list)

**Conclusion:** Selection is correctly scoped to visible items and cleared on filter change.

---

### ✅ Throttling Behavior
**Status:** CORRECT  
**Evidence:** Lines 367, 406-409

**Implementation:**
```typescript
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// In loop:
if (i < itemIds.length - 1) {
  await delay(200);
}
```

**Analysis:**
- ✅ 200ms delay between API calls
- ✅ Delay only applied between items (not after last item)
- ✅ Prevents API rate limiting issues

---

### ✅ Partial Failure Reporting
**Status:** CORRECT  
**Evidence:** Lines 362-365, 410-412, 419-430

**Implementation:**
```typescript
const results: { success: string[]; failed: string[] } = {
  success: [],
  failed: [],
};

// In loop:
try {
  // API call
  results.success.push(itemId);
} catch (err) {
  results.failed.push(itemId);
}

// After loop:
if (results.failed.length === 0) {
  setToast({
    message: `${actionLabel} ${results.success.length} post${results.success.length !== 1 ? "s" : ""}`,
    type: "success",
  });
} else {
  setToast({
    message: `${actionLabel} ${results.success.length} post${results.success.length !== 1 ? "s" : ""}, ${results.failed.length} failed`,
    type: "error",
  });
}
```

**Analysis:**
- ✅ Tracks both success and failed arrays
- ✅ Catches errors per-item without stopping the loop
- ✅ Reports both success and failure counts in toast
- ✅ Uses error toast type when any failures occur

---

## 2) Status Chips

### ✅ Mapping Rules (Including Blocked)
**Status:** CORRECT  
**Evidence:** `queueStatusUI.ts` lines 56-97

**Base Status Mappings:**
```typescript
const statusChips: Record<QueueStatus, QueueStatusChip> = {
  draft: { label: "Draft", tone: "neutral" },
  approved: { label: "Approved", tone: "success" },
  scheduled: { label: "Scheduled", tone: "warning" },
  posted: { label: "Posted", tone: "success" },
  failed: { label: "Failed", tone: "warning" },
};
```

**Blocked State Logic:**
- Lines 28-44: `isItemBlocked()` function
- Lines 61-67: Blocked chip returned when item is blocked
- Blocked when:
  - Item status is `scheduled` or `approved` AND
  - Connection state is `pending`, `disabled`, or `error`
- **Note:** `limited` connection state does NOT block (per requirements)

**Blocked Chip:**
```typescript
{
  label: "Blocked",
  tone: "warning",
  helper: "Blocked: publishing unavailable until accounts are connected.",
}
```

**Analysis:**
- ✅ All base statuses mapped correctly
- ✅ Blocked state derived from connection + item status
- ✅ Helper text explains blocked state
- ✅ Limited mode does not block (correct behavior)

---

### ✅ Connection-Awareness Behavior
**Status:** CORRECT  
**Evidence:** `queue/page.tsx` lines 727-732, 939-941

**Implementation:**
```typescript
// Get connection UI model for blocked status determination
const publishingEnabled = isMetaPublishingEnabled();
const connectionUI = getConnectionUIModel(connectionStatus, undefined, publishingEnabled);

// Get status chip using centralized helper
const statusChip = getQueueStatusChip(item, connectionUI);
```

**Connection States:**
- `pending` → Blocks scheduled/approved items
- `disabled` → Blocks scheduled/approved items
- `error` → Blocks scheduled/approved items
- `limited` → Does NOT block (allows queueing)
- `connected` → Does NOT block

**Analysis:**
- ✅ Connection status loaded on mount (lines 121-134)
- ✅ Status chips computed per-item with connection context
- ✅ Blocked state correctly derived from connection UI model
- ✅ Helper text shown in tooltip (line 750)

---

## 3) Tenant Safety

### ⚠️ Delete Route - Tenant Check
**Status:** MOSTLY SAFE (minor improvement possible)  
**Evidence:** `delete/route.ts` lines 35-40, 47-49

**Current Implementation:**
```typescript
// Check that the item exists and belongs to the user (tenant-safe)
const existingItem = await prisma.socialQueueItem.findFirst({
  where: {
    id: body.id,
    userId, // Tenant-safe: only delete items belonging to the current user
  },
});

if (!existingItem) {
  return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
}

// Delete the item
await prisma.socialQueueItem.delete({
  where: { id: body.id },
});
```

**Analysis:**
- ✅ Checks userId in `findFirst` query
- ✅ Returns 404 if item not found or doesn't belong to user
- ⚠️ Delete uses only `id` in where clause (not `userId`)
- **Risk:** Low - if item doesn't exist or belongs to another user, findFirst would have failed
- **Recommendation:** Include `userId` in delete where clause for defense-in-depth

**Suggested Fix:**
```typescript
await prisma.socialQueueItem.delete({
  where: { 
    id: body.id,
    userId, // Defense-in-depth: ensure we only delete user's own items
  },
});
```

---

### ⚠️ Approve Route - Tenant Check
**Status:** MOSTLY SAFE (minor improvement possible)  
**Evidence:** `approve/route.ts` lines 36-40, 84-87

**Current Implementation:**
```typescript
// Check that the item exists and belongs to the user
const existingItem = await prisma.socialQueueItem.findFirst({
  where: {
    id: body.id,
    userId,
  },
});

if (!existingItem) {
  return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
}

// ... build updateData ...

const updatedItem = await prisma.socialQueueItem.update({
  where: { id: body.id },
  data: updateData,
});
```

**Analysis:**
- ✅ Checks userId in `findFirst` query
- ✅ Returns 404 if item not found or doesn't belong to user
- ⚠️ Update uses only `id` in where clause (not `userId`)
- **Risk:** Low - if item doesn't exist or belongs to another user, findFirst would have failed
- **Recommendation:** Include `userId` in update where clause for defense-in-depth

**Suggested Fix:**
```typescript
const updatedItem = await prisma.socialQueueItem.update({
  where: { 
    id: body.id,
    userId, // Defense-in-depth: ensure we only update user's own items
  },
  data: updateData,
});
```

**Note:** Prisma's `update` with `where: { id }` will fail if the item doesn't exist, but including `userId` provides additional safety.

---

### ✅ Schedule Action - Tenant Check
**Status:** SAFE  
**Evidence:** `queue/page.tsx` lines 391-401

**Implementation:**
- Schedule uses the same `/api/social-auto-poster/queue/approve` endpoint
- Sends `status: "scheduled"` and `scheduledAt` timestamp
- Tenant safety inherited from approve route ✅

---

## 4) Verdict

### ✅ Overall Assessment: **PASS** (with minor recommendations)

**Strengths:**
1. ✅ Bulk actions correctly scope selection to visible items
2. ✅ Selection cleared on filter change
3. ✅ Throttling implemented (200ms delay)
4. ✅ Partial failure reporting tracks and reports both success/failure
5. ✅ Status chips correctly map all statuses including Blocked
6. ✅ Connection-awareness correctly derives Blocked state
7. ✅ Tenant checks present in both delete and approve routes

**Minor Recommendations (Non-Blocking):**
1. **Defense-in-depth:** Include `userId` in delete route's `where` clause
2. **Defense-in-depth:** Include `userId` in approve route's `update` where clause

**Risk Assessment:**
- **Current risk:** LOW - Tenant checks are present and functional
- **Recommended improvements:** Very low risk mitigation (defense-in-depth)
- **Impact if not fixed:** Minimal - existing checks prevent unauthorized access

---

## Recommendations

### Priority: Low (Defense-in-Depth)

**1. Delete Route Enhancement:**
```typescript
// In delete/route.ts, line 47-49
await prisma.socialQueueItem.delete({
  where: { 
    id: body.id,
    userId, // Add this for defense-in-depth
  },
});
```

**2. Approve Route Enhancement:**
```typescript
// In approve/route.ts, line 84-87
const updatedItem = await prisma.socialQueueItem.update({
  where: { 
    id: body.id,
    userId, // Add this for defense-in-depth
  },
  data: updateData,
});
```

**Rationale:**
- Current implementation is functionally safe (findFirst check prevents unauthorized access)
- Adding userId to where clauses provides defense-in-depth
- Prevents edge cases if Prisma behavior changes or if there's a race condition
- Minimal code change with clear security benefit

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| **Bulk Actions - Selection** | ✅ PASS | Visible only, cleared on filter change |
| **Bulk Actions - Throttling** | ✅ PASS | 200ms delay between calls |
| **Bulk Actions - Partial Failure** | ✅ PASS | Tracks and reports both success/failure |
| **Status Chips - Mapping** | ✅ PASS | All statuses including Blocked mapped correctly |
| **Status Chips - Connection-Aware** | ✅ PASS | Blocked state correctly derived |
| **Tenant Safety - Delete** | ⚠️ PASS* | Functional but could add userId to where clause |
| **Tenant Safety - Approve** | ⚠️ PASS* | Functional but could add userId to where clause |
| **Tenant Safety - Schedule** | ✅ PASS | Inherits safety from approve route |

**Overall Verdict:** ✅ **PASS**  
**Tier 5C Compliance:** ✅ **CONFIRMED** (with minor defense-in-depth recommendations)

---

**Audit Status:** ✅ **PASS**  
**Action Required:** Optional defense-in-depth improvements (non-blocking)

