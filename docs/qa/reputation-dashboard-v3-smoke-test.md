# Reputation Dashboard V3 - Production Smoke Test

**Duration:** < 2 minutes  
**Purpose:** Quick verification that core functionality works after deployment

## Pre-Test Setup
1. Navigate to `/apps/reputation-dashboard`
2. Clear browser console (F12 → Console tab → Clear)

## Smoke Test Steps

### Step 1: Empty State (5 seconds)
- [ ] Verify empty state message displays: "No reviews yet — add or import to begin."
- [ ] Verify "Generate Dashboard" button is disabled
- [ ] Verify Export JSON, Export CSV, and Print buttons are disabled

### Step 2: Add Single Review (15 seconds)
- [ ] Click "Add Review" button
- [ ] Fill form:
  - Platform: Google
  - Rating: 5
  - Review Text: "Great service!"
  - Review Date: Today's date
  - Responded: No
- [ ] Click "Add Review" in modal
- [ ] Verify review appears in list
- [ ] Close modal (ESC key or X button)

### Step 3: Generate Dashboard (10 seconds)
- [ ] Click "Generate Dashboard" button
- [ ] Wait for results (should be < 2 seconds)
- [ ] Verify KPIs display (Reputation Score, Avg Rating, Review Count, Response Rate, Median Response Time)
- [ ] Verify "Last computed" timestamp appears in header
- [ ] Verify "Snapshot ID: RD-XXXXXXXX" chip appears in header

### Step 4: Score Breakdown (10 seconds)
- [ ] Click "ℹ️ How it's calculated" link on Reputation Score tile
- [ ] Verify breakdown modal opens
- [ ] Verify it shows: Total Score, Rating Component, Response Component, Raw Inputs
- [ ] Close modal (ESC key or X button)

### Step 5: CSV Template Download (5 seconds)
- [ ] Click "Download Template" button
- [ ] Verify CSV file downloads
- [ ] Verify file contains example data with correct headers

### Step 6: CSV Import Preview (15 seconds)
- [ ] Click "Import CSV" button
- [ ] Select the downloaded template file (or any CSV with review data)
- [ ] Verify preview modal opens
- [ ] Verify it shows: "CSV Preview (X valid reviews)"
- [ ] If errors exist, verify they display in "Row Errors" section
- [ ] Click "Confirm Import" (or "Cancel" to skip)

### Step 7: Export JSON (5 seconds)
- [ ] Click "Export JSON" button
- [ ] Verify JSON file downloads
- [ ] Open file and verify it contains `computedAt` and `snapshotId` fields

### Step 8: Print View (5 seconds)
- [ ] Click "Print Report" button
- [ ] Verify print preview shows:
  - Report header with business name
  - "Report generated: [timestamp]"
  - "Snapshot ID: RD-XXXXXXXX"
  - All dashboard content (KPIs, charts, themes, etc.)
- [ ] Close print preview (ESC or Cancel)

### Step 9: Persistence (10 seconds)
- [ ] Refresh page (F5)
- [ ] Verify data is restored:
  - Business name still filled
  - Reviews still in list
  - Last computed timestamp still visible
- [ ] Verify dashboard results are still displayed (if previously generated)

### Step 10: Clear Data (5 seconds)
- [ ] Click "Clear Data" button
- [ ] Confirm dialog
- [ ] Verify everything resets:
  - Form fields cleared
  - Reviews list empty
  - Dashboard results gone
  - Empty state message appears

## Post-Test Verification
- [ ] Check browser console for errors (should be empty)
- [ ] Verify no 500 errors in network tab
- [ ] Verify all buttons are accessible via keyboard (Tab navigation)
- [ ] Verify modals close with ESC key

## Expected Results
- ✅ All steps complete without errors
- ✅ No console errors
- ✅ All functionality works as expected
- ✅ Data persists across page refresh
- ✅ Clear Data resets everything

## If Issues Found
1. Check browser console for error messages
2. Check network tab for failed API requests
3. Verify localStorage is enabled in browser
4. Check server logs for 500 errors
5. Report issues to OBD development team with:
   - Step number where issue occurred
   - Browser and version
   - Console error messages
   - Network request details

---

**Test Date:** _______________  
**Tester:** _______________  
**Result:** ✅ PASS / ❌ FAIL  
**Notes:** _______________

