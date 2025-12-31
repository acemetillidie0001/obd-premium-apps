# OBD CRM V3 — Final Ship Checklist

**Version:** V3  
**Release Date:** 2025-12-30  
**Status:** Production Ready

---

## Pre-Deployment: Local Development

### 1. Database Migration (Local Dev)

```bash
# 1. Create and apply migration
npx prisma migrate dev --name add_obd_crm_models

# 2. Generate Prisma Client (REQUIRED - build will fail without this)
npx prisma generate

# 3. Verify build passes
npm run build
```

**Critical:** The build will fail until `npx prisma generate` is run after migration creation.

**Verification:**
- [ ] Migration created successfully
- [ ] `npx prisma generate` completed without errors
- [ ] `npm run build` succeeds with zero errors
- [ ] Migration SQL reviewed for safety

---

## Production Deployment

### 1. Database Migration (Production)

```bash
# Set DATABASE_URL to production (if not already set)
# $env:DATABASE_URL="postgresql://..." (PowerShell)
# export DATABASE_URL="postgresql://..." (bash)

# 1. Deploy migration (applies existing migration, does NOT create new one)
npm run db:deploy
# OR: npx prisma migrate deploy

# 2. Generate Prisma Client (required for TypeScript in production build)
npm run db:generate
# OR: npx prisma generate

# 3. Verify migration status
npm run db:status
# OR: npx prisma migrate status
```

**Verification:**
- [ ] `npm run db:deploy` completed successfully
- [ ] `npm run db:generate` completed without errors
- [ ] `npm run db:status` shows all migrations applied
- [ ] No errors in migration output

### 2. Code Deployment

Deploy code changes via your standard deployment process (Vercel, Railway, etc.).

**Verification:**
- [ ] Build succeeds in CI/CD
- [ ] No TypeScript compilation errors
- [ ] No ESLint errors blocking deployment
- [ ] Deployment completed successfully

---

## Post-Deployment Verification

### 1. Navigation & Access

- [ ] Navigation shows "OBD CRM" as LIVE/available
- [ ] Can navigate to `/apps/obd-crm` without errors
- [ ] Page loads successfully
- [ ] No console errors in browser DevTools

### 2. Core Functionality

**Create Contact:**
- [ ] Click "Add Contact" opens modal
- [ ] Can create contact with name (minimum required field)
- [ ] Contact appears in table after creation
- [ ] Can create contact with full details (email, phone, company, address)

**Tag Management:**
- [ ] Can create a tag via API or UI
- [ ] Can assign tag to contact
- [ ] Tag appears in contact detail view
- [ ] Tag filter works in contacts list

**Notes & Activity:**
- [ ] Can add note to contact from detail page
- [ ] Note appears in activity timeline
- [ ] Notes ordered newest first
- [ ] Last note preview appears in contacts list

**CSV Export:**
- [ ] "Export CSV" button works
- [ ] CSV downloads with correct filename: `obd-crm-contacts-YYYY-MM-DD.csv`
- [ ] CSV opens correctly in Excel/Google Sheets
- [ ] Export respects current filters/search
- [ ] All columns present: name, email, phone, status, tags, source, createdAt, updatedAt, lastNote

### 3. Business Scoping (Security Check)

**Important:** Verify contacts are properly scoped to the authenticated user's business.

- [ ] Create a contact as User A
- [ ] Log out and log in as User B (different account)
- [ ] Verify User B cannot see User A's contacts
- [ ] Verify User B's contact list is empty (or only shows User B's contacts)
- [ ] Verify tags are scoped correctly (User B cannot see User A's tags)

**API Test (if needed):**
```bash
# As User A - create contact, note the contact ID
# As User B - try to access User A's contact
# GET /api/obd-crm/contacts/[user-a-contact-id]
# Expected: 404 "Contact not found"
```

### 4. Error Handling

- [ ] Validation errors display correctly (e.g., name too short)
- [ ] API errors show user-friendly messages
- [ ] Empty states display correctly
- [ ] Loading states work (skeleton rows, disabled buttons)

---

## Rollback Plan (If Issues Found)

### Database Rollback

```bash
# If migration needs to be rolled back:
npx prisma migrate resolve --rolled-back add_obd_crm_models

# Then revert code deployment via your standard process
```

### Data Preservation

- CRM data will remain in database even if code is rolled back
- Can be cleaned up manually if needed
- No data loss from rollback (schema changes are additive only)

---

## Success Criteria

✅ All migrations applied successfully  
✅ Build passes without errors  
✅ Core functionality verified (create, tag, note, export)  
✅ Business scoping verified (security check passes)  
✅ No console errors or warnings  
✅ All smoke tests pass  

**Status:** 🚢 Ready to Ship

