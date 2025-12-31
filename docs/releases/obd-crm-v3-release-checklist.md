# OBD CRM V3 Release Checklist

**Version:** V3  
**Release Date:** [To be filled]  
**Status:** Production Ready

## Pre-Release Verification

### 1. Database Migration

**Important:** Prisma Client must be generated after creating the migration for TypeScript to recognize the new models.

- [ ] Schema validated: `npx prisma validate` (must pass)
- [ ] Migration created: `npx prisma migrate dev --name add_obd_crm_models`
- [ ] Prisma Client generated: `npx prisma generate`
- [ ] Build succeeds: `npm run build` (TypeScript should now recognize CrmContact, CrmTag, etc.)
- [ ] Migration SQL reviewed for safety
- [ ] Production migration plan documented (use `prisma migrate deploy`)

**Note:** TypeScript build will fail until `npx prisma generate` is run after migration creation.

### 2. Build Verification

**Note:** Build will fail until `npx prisma generate` is run after migration creation.

- [ ] After migration + `prisma generate`: `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes for release-scoped paths (already verified - no lint errors)
- [ ] No TypeScript errors (after Prisma Client generation)
- [ ] No ESLint errors in new files (already verified)

### 3. Code Quality

- [ ] All API routes follow standard response format (`{ ok: true/false }`)
- [ ] All database queries scoped to `businessId = userId`
- [ ] Error handling uses `handleApiError` utility
- [ ] Validation uses Zod schemas
- [ ] Premium access guards in place

## Smoke Test Checklist

Execute these tests in order on a clean dev environment (or production after deployment).

### Setup

1. Ensure you're logged in as a premium user
2. Navigate to `/apps/obd-crm`
3. Clear any existing demo data (if using dev helper)

---

### Test 1: Create Contact

**Steps:**
1. Click "Add Contact" button
2. Fill in form:
   - Name: "John Doe" (required)
   - Email: "john@example.com"
   - Phone: "555-1234"
   - Company: "Acme Corp"
   - Address: "123 Main St, Ocala, FL"
   - Status: "Lead"
3. Click "Create Contact"

**Expected:**
- ✅ Modal closes
- ✅ Contact appears in table
- ✅ Contact shows correct name, email, phone
- ✅ Status badge displays "Lead" with correct color
- ✅ No errors displayed

---

### Test 2: Create Contact (Minimal)

**Steps:**
1. Click "Add Contact"
2. Fill in only:
   - Name: "Jane Smith" (required)
3. Click "Create Contact"

**Expected:**
- ✅ Contact created successfully
- ✅ Email, phone show as "—" in table
- ✅ Default status is "Lead"

---

### Test 3: Edit Contact

**Steps:**
1. Click on "John Doe" contact in table (navigates to detail page)
2. Click "Edit" button
3. Change:
   - Name: "John A. Doe"
   - Email: "john.doe@example.com"
   - Status: "Active"
4. Click "Save"

**Expected:**
- ✅ Changes saved successfully
- ✅ Status badge updates to "Active" with correct color
- ✅ Updated timestamp changes
- ✅ No errors displayed

---

### Test 4: Create and Assign Tags

**Steps:**
1. From contact detail page, click "Edit"
2. Scroll to Tags section
3. Click on a tag (if exists) or create new tags via API:
   - Create tag "VIP" via POST `/api/obd-crm/tags` with `{ "name": "VIP" }`
   - Create tag "Follow-up" via POST `/api/obd-crm/tags` with `{ "name": "Follow-up" }`
4. In edit mode, click tags to select them (they should highlight)
5. Click "Save"

**Expected:**
- ✅ Tags appear as selected (highlighted) in edit mode
- ✅ After save, tags display in contact detail
- ✅ Tags appear in contacts list table
- ✅ Tags are properly scoped to business

---

### Test 5: Add Notes

**Steps:**
1. Navigate to contact detail page
2. In "Notes & Activity" section, type: "Had a great conversation about their needs"
3. Click "Add Note"

**Expected:**
- ✅ Note appears in activity timeline immediately
- ✅ Note shows timestamp
- ✅ Notes ordered newest first
- ✅ Empty note shows placeholder text

---

### Test 6: Multiple Notes

**Steps:**
1. Add 3 more notes:
   - "Followed up via email"
   - "Scheduled meeting for next week"
   - "Sent proposal"
2. Verify order

**Expected:**
- ✅ All notes visible
- ✅ Newest note appears at top
- ✅ Each note has timestamp

---

### Test 7: Search Filter

**Steps:**
1. Return to contacts list (`/apps/obd-crm`)
2. In search box, type "John"
3. Verify results

**Expected:**
- ✅ Only contacts matching "John" appear
- ✅ Search is case-insensitive
- ✅ Search works across name, email, phone

**Steps (continue):**
4. Clear search box
5. Type "example.com" (email search)

**Expected:**
- ✅ Contacts with matching emails appear
- ✅ Search works across multiple fields

---

### Test 8: Status Filter

**Steps:**
1. In status dropdown, select "Active"
2. Verify filtered results

**Expected:**
- ✅ Only contacts with "Active" status shown
- ✅ Status filter works independently

**Steps (continue):**
3. Change to "Lead"
4. Verify filtered results

**Expected:**
- ✅ Only "Lead" contacts shown
- ✅ Filter updates correctly

---

### Test 9: Tag Filter

**Steps:**
1. Create at least one contact with a tag (use Test 4)
2. Return to contacts list
3. In tag filter dropdown, select the tag name
4. Verify results

**Expected:**
- ✅ Only contacts with selected tag appear
- ✅ Filter works correctly
- ✅ Contacts without tags excluded when filter is active

---

### Test 10: Combined Filters

**Steps:**
1. Set search: "John"
2. Set status: "Active"
3. Set tag: "VIP" (if available)
4. Verify results

**Expected:**
- ✅ Only contacts matching ALL filters shown
- ✅ Filters are AND-combined correctly
- ✅ No contacts shown if no match all criteria

---

### Test 11: Export CSV (No Filters)

**Steps:**
1. Clear all filters and search
2. Click "Export CSV" button
3. Verify download

**Expected:**
- ✅ Button shows "Exporting…" loading state while processing
- ✅ Button is disabled during export
- ✅ CSV file downloads with name: `obd-crm-contacts-YYYY-MM-DD.csv` (matches current date)
- ✅ File opens in spreadsheet app (Excel, Google Sheets, etc.)
- ✅ Header row contains (in order): `name,email,phone,status,tags,source,createdAt,updatedAt,lastNote`
- ✅ All contacts included in export (no pagination - exports all matches)
- ✅ Tags are pipe-separated in tags column: `Tag1 | Tag2 | Tag3`
- ✅ Dates in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
- ✅ Empty/null values are exported as empty strings
- ✅ lastNote column shows most recent note (truncated to 200 chars if longer)
- ✅ Loading state clears after download completes

---

### Test 12: Export CSV (With Filters)

**Steps:**
1. Set search: "John"
2. Set status: "Active"
3. Click "Export CSV"
4. Verify download

**Expected:**
- ✅ Only filtered contacts in CSV
- ✅ Row count matches filtered contact count from list
- ✅ All columns present
- ✅ Filters are applied correctly (same as list view)

**Steps (continue):**
5. Clear filters, set tag filter to "VIP"
6. Click "Export CSV"
7. Verify download

**Expected:**
- ✅ Only contacts with selected tag in export
- ✅ Tag filter respected

---

### Test 12a: CSV Export - Special Characters Escaping

**Steps:**
1. Create a contact with:
   - Name: `John "Johnny" Doe, Jr.`
   - Email: `john@example.com`
   - Company: `Acme, Inc.`
   - Note (add via detail page): `This is a note with "quotes" and a comma, plus a newline\nhere`
2. Export CSV
3. Open CSV in spreadsheet app

**Expected:**
- ✅ Fields with commas, quotes, or newlines are wrapped in double quotes
- ✅ Quotes inside quoted fields are escaped (doubled): `"John ""Johnny"" Doe, Jr."`
- ✅ CSV parses correctly in Excel/Google Sheets
- ✅ No broken rows or columns
- ✅ All special characters preserved correctly

---

### Test 12b: CSV Export - Error Handling

**Steps:**
1. Open browser DevTools Network tab
2. Temporarily block network requests to `/api/obd-crm/export` (or disconnect network)
3. Click "Export CSV"

**Expected:**
- ✅ Button shows "Exporting…" state
- ✅ After failure, button returns to "Export CSV"
- ✅ Friendly error message displayed: "Export failed" or similar
- ✅ Error message appears inline (not as console error only)
- ✅ User can retry export after error

---

### Test 12c: CSV Export - Empty/null Values

**Steps:**
1. Create contact with minimal fields (name only, no email/phone/tags/notes)
2. Export CSV
3. Verify CSV content

**Expected:**
- ✅ Empty fields exported as empty strings (not "null" or "undefined")
- ✅ CSV has correct number of columns
- ✅ Spreadsheet opens without errors
- ✅ Empty columns are blank (not showing "null" text)

---

### Test 13: Direct Link Navigation

**Steps:**
1. Get contact ID from list or API response
2. Navigate directly to: `/apps/obd-crm/contacts/[contact-id]`
3. Verify page loads

**Expected:**
- ✅ Contact detail page loads correctly
- ✅ All contact information displays
- ✅ Notes section visible
- ✅ Edit/Delete buttons present

---

### Test 14: Delete Contact

**Steps:**
1. Navigate to contact detail page
2. Click "Delete" button
3. Confirm deletion in browser dialog
4. Verify redirect

**Expected:**
- ✅ Confirmation dialog appears
- ✅ After confirmation, contact deleted
- ✅ Redirect to `/apps/obd-crm`
- ✅ Contact no longer in list
- ✅ Associated notes and tag relations deleted (cascade)

---

### Test 15: Business Scoping (Security)

**Steps:**
1. Log in as User A (premium)
2. Create a contact via API: `POST /api/obd-crm/contacts`
3. Note the contact ID
4. Log out, log in as User B (premium, different account)
5. Attempt to access contact: `GET /api/obd-crm/contacts/[user-a-contact-id]`

**Expected:**
- ✅ Request returns 404 "Contact not found"
- ✅ User B cannot access User A's contacts
- ✅ User B's contact list does not include User A's contacts
- ✅ Tags are scoped correctly (User B cannot see User A's tags)

---

### Test 16: Validation Errors

**Steps:**
1. Click "Add Contact"
2. Leave name empty
3. Try to submit

**Expected:**
- ✅ Validation error displayed
- ✅ Form does not submit
- ✅ Error message is user-friendly

**Steps (continue):**
4. Enter name: "A" (less than 2 characters)
5. Try to submit

**Expected:**
- ✅ Validation error: "Name must be at least 2 characters"
- ✅ Form does not submit

**Steps (continue):**
6. Enter invalid email: "not-an-email"
7. Try to submit

**Expected:**
- ✅ Validation error for email format
- ✅ Form does not submit

---

### Test 17: Empty States

**Steps:**
1. Delete all contacts (via API or UI)
2. Navigate to `/apps/obd-crm`
3. Verify empty state

**Expected:**
- ✅ Empty state message: "No contacts yet"
- ✅ Helper text: "Add your first contact to get started."
- ✅ "Add Contact" button visible

**Steps (continue):**
4. Create a contact
5. Navigate to contact detail
6. Verify notes empty state

**Expected:**
- ✅ Empty state message: "No activity yet"
- ✅ Helper text: "Add a note to track this relationship."
- ✅ Note input form visible

---

### Test 18: Delete Tag

**Steps:**
1. Create a tag via API: `POST /api/obd-crm/tags` with `{ "name": "Test Tag" }`
2. Assign tag to a contact
3. Delete tag via API: `DELETE /api/obd-crm/tags?id=[tag-id]`
4. Check contact detail

**Expected:**
- ✅ Tag deleted successfully
- ✅ Tag no longer appears in contact's tag list
- ✅ Tag relation removed (cascade)
- ✅ Contact still exists (only tag relation deleted)

---

## Post-Release Verification

### Immediate (Within 1 hour)

- [ ] All smoke tests pass in production
- [ ] No console errors in browser DevTools
- [ ] No server errors in logs
- [ ] Database migration applied successfully
- [ ] API routes respond correctly

### 24-Hour Check

- [ ] Monitor error logs for new issues
- [ ] Check database query performance
- [ ] Verify no memory leaks or performance degradation
- [ ] Review user feedback (if any)

## Rollback Plan

If critical issues are discovered:

1. **Database Rollback:**
   ```bash
   # Rollback migration (if needed)
   npx prisma migrate resolve --rolled-back add_obd_crm_models
   ```

2. **Code Rollback:**
   - Revert commit that adds OBD CRM V3
   - Redeploy previous version

3. **Data Preservation:**
   - CRM data will remain in database even if code is rolled back
   - Can be cleaned up manually if needed

## Known Limitations

- Tag filter is single-select (V3 scope)
- No bulk operations
- No CSV import (export only)
- No pipelines/deals (V4 feature)
- No automations (V4 feature)

## Next Steps (V4 Ideas)

- Pipeline/deals system
- Contact automations
- Email sync
- SMS integration
- Calendar sync
- CSV import
- Bulk operations
- Advanced activity types (beyond notes)

