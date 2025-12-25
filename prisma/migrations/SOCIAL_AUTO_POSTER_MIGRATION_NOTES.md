# Social Auto-Poster Migration Notes

## New Models Added

### 1. SocialAutoposterSettings
- One-to-one relationship with User
- Stores user's posting preferences, brand voice, scheduling rules, and enabled platforms

### 2. SocialQueueItem
- One-to-many relationship with User
- Stores queued posts with status, scheduling, and metadata
- Indexes on userId, status, scheduledAt for efficient queries

### 3. SocialDeliveryAttempt
- One-to-many relationship with User and SocialQueueItem
- Activity log for delivery attempts (success/failure)
- Indexes on userId, queueItemId, attemptedAt, success

## New Enums

- `SocialPlatform`: facebook, instagram, x, googleBusiness
- `PostingMode`: review, auto, campaign
- `QueueStatus`: draft, approved, scheduled, posted, failed

## Migration Steps

1. Run Prisma migration:
   ```bash
   npx prisma migrate dev --name add_social_auto_poster
   ```

2. Verify the migration:
   ```bash
   npx prisma studio
   ```

3. Test the API routes to ensure database operations work correctly.

## Notes

- All models include proper indexes for performance
- Foreign key constraints ensure data integrity
- User deletion cascades to related records
- The Mock Provider (V3A) uses simulated posting; real OAuth will be added in V3B

