# OBD CRM V3 Migration Notes

Quick reference for database migration commands.

## Migration Commands

### Development (Create Migration)

```bash
# 1. Validate schema
npx prisma validate

# 2. Create and apply migration
npx prisma migrate dev --name add_obd_crm_models

# 3. Generate Prisma Client (REQUIRED for TypeScript)
npx prisma generate

# 4. Verify build
npm run build
```

### Production (Apply Existing Migration)

```bash
# 1. Deploy migration (applies pending migrations, does not create new ones)
npx prisma migrate deploy

# 2. Generate Prisma Client
npx prisma generate
```

## Important Notes

1. **Prisma Client Generation Required**: TypeScript build will fail until `npx prisma generate` is run after migration creation.

2. **Schema Validation**: The schema has been validated with `npx prisma validate` and passes.

3. **Indexes**: All necessary indexes are in place:
   - CrmContact: businessId, businessId+status, businessId+updatedAt, businessId+name
   - CrmContactActivity: contactId, businessId, businessId+createdAt
   - CrmTag: businessId, unique(businessId+name)
   - CrmContactTag: unique(contactId+tagId), indexes on contactId and tagId

4. **Cascade Rules**: All cascade rules ensure referential integrity:
   - Contact deletion → cascades to activities and tag relations
   - Tag deletion → cascades to tag relations (contacts remain)
   - No orphan records possible

## Schema Changes Summary

New models:
- `CrmContact` (with CrmContactStatus and CrmContactSource enums)
- `CrmTag`
- `CrmContactTag` (join table)
- `CrmContactActivity`

No breaking changes to existing models.

