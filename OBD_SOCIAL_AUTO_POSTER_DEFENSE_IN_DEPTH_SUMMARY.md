# OBD Social Auto-Poster — Defense-in-Depth: userId in Mutation Where Clauses

**Date:** 2024-12-19  
**Status:** ✅ Complete — All checks passed

---

## Summary

Added defense-in-depth tenant safety by including `userId` in Prisma mutation where clauses for Social Auto-Poster queue operations. This ensures that even if authorization checks are bypassed, mutations can only affect the authenticated user's own data.

---

## Changes Made

### 1. Delete Route (`src/app/api/social-auto-poster/queue/delete/route.ts`)

**Before:**
```typescript
await prisma.socialQueueItem.delete({
  where: { id: body.id },
});
```

**After:**
```typescript
const deleteResult = await prisma.socialQueueItem.deleteMany({
  where: {
    id: body.id,
    userId, // Defense-in-depth: ensure we only delete user's own items
  },
});

// If no rows were affected, return 404 (shouldn't happen after findFirst check, but defense-in-depth)
if (deleteResult.count === 0) {
  return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
}
```

**Changes:**
- Changed from `delete()` to `deleteMany()` to include `userId` in where clause
- Added check for `deleteResult.count === 0` to return 404 if no rows affected
- Preserved existing `findFirst` authorization check (unchanged)

---

### 2. Approve Route (`src/app/api/social-auto-poster/queue/approve/route.ts`)

**Before:**
```typescript
const updatedItem = await prisma.socialQueueItem.update({
  where: { id: body.id },
  data: updateData,
});
```

**After:**
```typescript
// Update the item (defense-in-depth: include userId in where clause)
const updateResult = await prisma.socialQueueItem.updateMany({
  where: {
    id: body.id,
    userId, // Defense-in-depth: ensure we only update user's own items
  },
  data: updateData,
});

// If no rows were affected, return 404 (shouldn't happen after findFirst check, but defense-in-depth)
if (updateResult.count === 0) {
  return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
}

// Fetch the updated item to return in response
const updatedItem = await prisma.socialQueueItem.findUnique({
  where: { id: body.id },
});

if (!updatedItem) {
  return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
}
```

**Changes:**
- Changed from `update()` to `updateMany()` to include `userId` in where clause
- Added check for `updateResult.count === 0` to return 404 if no rows affected
- Added `findUnique()` call after update to fetch the updated item (since `updateMany` doesn't return the item)
- Added check for `updatedItem` existence before returning response
- Preserved existing `findFirst` authorization check (unchanged)

---

## Security Benefits

1. **Defense-in-Depth:** Even if authorization checks are bypassed or have bugs, mutations are scoped by `userId`
2. **Race Condition Protection:** Prevents edge cases where item ownership changes between authorization check and mutation
3. **Consistent Error Handling:** Returns 404 if no rows affected, maintaining consistent API behavior

---

## Behavior Preservation

- ✅ Existing authorization checks (`findFirst` with `userId`) remain unchanged
- ✅ Authorized users experience no change in behavior
- ✅ Error responses remain consistent (404 for not found)
- ✅ Response format unchanged (delete returns `{ ok: true }`, approve returns item object)

---

## Verification Results

### ✅ TypeScript Type Check
```bash
pnpm run typecheck
```
**Result:** Passed (exit code 0)

### ✅ ESLint
```bash
pnpm run lint
```
**Result:** Passed (exit code 0, 21 warnings - all pre-existing, none related to changes)

### ✅ Vercel Build
```bash
pnpm run vercel-build
```
**Result:** Passed (exit code 0, build completed successfully)

---

## Files Modified

1. `src/app/api/social-auto-poster/queue/delete/route.ts`
2. `src/app/api/social-auto-poster/queue/approve/route.ts`

**Note:** No separate schedule route exists - scheduling uses the approve route with `status: "scheduled"`, so it's already covered.

---

## Testing Recommendations

1. **Authorized User:** Verify delete/approve operations work normally
2. **Unauthorized User:** Verify 404 responses when attempting to modify another user's items
3. **Race Condition:** Verify that if item ownership changes between check and mutation, mutation affects 0 rows and returns 404

---

**Status:** ✅ **COMPLETE**  
**All Checks:** ✅ **PASSED**

