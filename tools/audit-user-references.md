# Prisma Schema Audit: User Model References

## Summary

**Date:** 2025-01-02  
**Migration in Question:** `20251225045724_add_review_request_automation_tables`  
**Issue:** Migration creates foreign keys referencing `User` table, which may not exist if `add_auth_models` migration hasn't run.

## User Model Status

✅ **User model EXISTS in schema.prisma** (lines 9-35)

The User model is properly defined with:
- Primary key: `id` (String, cuid)
- Unique constraint: `email`
- Required fields: `email`, `role`, `isPremium`
- Optional fields: `name`, `emailVerified`, `image`
- Timestamps: `createdAt`, `updatedAt`

## Models Referencing User (Foreign Keys)

### 1. Account (line 50)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many Accounts)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid

### 2. Session (line 61)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many Sessions)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid

### 3. UsageCounter (line 101)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many UsageCounters)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid
- **Migration:** Created in `20251225045724_add_review_request_automation_tables`

### 4. BrandProfile (line 138)
- **Field:** `userId` → `User.id` (unique)
- **Relation:** One-to-one (User has one BrandProfile)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid

### 5. ReviewRequestCampaign (line 164)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many ReviewRequestCampaigns)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid
- **Migration:** Created in `20251225045724_add_review_request_automation_tables`

### 6. ReviewRequestCustomer (line 187)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many ReviewRequestCustomers)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid
- **Migration:** Created in `20251225045724_add_review_request_automation_tables`

### 7. ReviewRequestQueueItem (line 213)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many ReviewRequestQueueItems)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid
- **Migration:** Created in `20251225045724_add_review_request_automation_tables`

### 8. ReviewRequestDataset (line 232)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many ReviewRequestDatasets)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid
- **Migration:** Created in `20251225045724_add_review_request_automation_tables`

### 9. SocialAutoposterSettings (line 258)
- **Field:** `userId` → `User.id` (unique)
- **Relation:** One-to-one (User has one SocialAutoposterSettings)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid

### 10. SocialQueueItem (line 294)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many SocialQueueItems)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid

### 11. SocialDeliveryAttempt (line 317)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many SocialDeliveryAttempts)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid

### 12. SocialAccountConnection (line 474)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many SocialAccountConnections)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid

### 13. SocialPostingDestination (line 489)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many SocialPostingDestinations)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid

### 14. SocialPublishAttempt (line 506)
- **Field:** `userId` → `User.id`
- **Relation:** One-to-many (User has many SocialPublishAttempts)
- **Cascade:** ON DELETE CASCADE
- **Status:** ✅ Valid

## Migration Analysis

### Migration: `add_auth_models/migration.sql`
- **Creates:** `User` table
- **Status:** ✅ Required before any User foreign keys
- **Issue:** Non-timestamped migration may not run in correct order

### Migration: `20251225045724_add_review_request_automation_tables`
- **Creates:** 5 tables with User foreign keys:
  1. `UsageCounter` (line 158)
  2. `ReviewRequestCampaign` (line 161)
  3. `ReviewRequestCustomer` (line 164)
  4. `ReviewRequestQueueItem` (line 170)
  5. `ReviewRequestDataset` (line 179)
- **Issue:** ⚠️ Assumes `User` table exists
- **Failure Point:** Foreign key constraints will fail if User table doesn't exist

## Root Cause

The migration `20251225045724_add_review_request_automation_tables` creates foreign keys to the `User` table, but:
1. The `User` table is created in `add_auth_models` (non-timestamped migration)
2. Non-timestamped migrations may not run before timestamped ones
3. If `add_auth_models` hasn't run, the foreign key constraints will fail

## Schema Validation

✅ **All User references in schema.prisma are VALID**

The schema.prisma file is correct:
- User model exists
- All foreign key references are properly typed
- All relations are correctly defined
- Cascade behaviors are appropriate

## Recommendations

### Option 1: Ensure User Table Exists (Recommended)
1. Verify `add_auth_models` migration has run
2. If not, run it manually before `20251225045724_add_review_request_automation_tables`
3. Mark the failed migration as rolled back
4. Re-run the migration

### Option 2: Make Foreign Keys Optional (NOT Recommended)
- This would break data integrity
- Not recommended for production

### Option 3: Check Migration Order
- Ensure all non-timestamped migrations run before timestamped ones
- Consider renaming `add_auth_models` to a timestamped format

## Conclusion

✅ **Schema is CORRECT** - No changes needed to schema.prisma

The issue is **migration ordering**, not schema definition. The User model and all its references are valid. The migration failure is due to the User table not existing when the foreign keys are created.

