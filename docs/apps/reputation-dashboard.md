# Reputation Dashboard — Tier 5C (Production-Ready)

**Route:** `/apps/reputation-dashboard`  
**Category:** Reputation  
**Tier status:** **Tier 5C** (snapshot-based, localStorage-only snapshots, advisory-only)  

---

## Status Banner

**Production-ready**. **Tier 5C** posture:

- **Snapshot-based**: viewing is deterministic from the active saved snapshot.
- **localStorage-only**: snapshots are stored in the browser; no new DB persistence is introduced by this app.
- **Advisory-only**: insights are informational; no automation.
- **No automation**: no background jobs, no auto-responding, no auto-sending.

---

## What this app is

- A reputation analysis workspace for **manually entered** or **CSV-imported** reviews.
- A **snapshot-driven** dashboard that freezes outputs for review and reporting.
- A deterministic UI for KPIs, trends, themes, sentiment, and response coverage.
- A safe “Next Steps” launcher to other OBD apps (Tier 5C) using **link-only** CTAs or **draft-only** handoffs.

## What this app is NOT

Explicit non-goals / exclusions:

- No automatic review syncing from Google/Facebook/Yelp or any other platform.
- No review scraping.
- No incentives, gating, or gamification around reviews.
- No filtering, hiding, or soft-deleting negative reviews.
- No auto-respond, auto-generate, auto-send, or auto-post actions.
- No background jobs / cron / scheduled processing.

---

## Data Model + Storage

### Inputs (manual + CSV only)

- **Manual entry**: reviews are entered via UI.
- **CSV import**: reviews are imported via a preview step before being added to the dataset.
- The dashboard computes from the current in-page dataset, then snapshots freeze a deterministic view.

### Storage layers (browser-only)

#### 1) Draft form persistence (convenience)

- Purpose: keep in-progress inputs if the user refreshes the page.
- Stored in `localStorage` under:
  - `reputation-dashboard-data`

#### 2) Immutable snapshots (Tier 5B)

- Purpose: freeze a report-grade view; **viewing never recomputes**.
- Stored in `localStorage` using business-scoped keys:
  - `reputation:snapshots:{businessId}` (array; **cap 20**; newest-first)
  - `reputation:activeSnapshotId:{businessId}` (pointer to selected snapshot)

Notes:
- Snapshots store `request` (inputs) and `response` (computed outputs) so rendering is deterministic.
- Snapshots are scoped to a tenant/business identifier (`businessId`) and never cross businesses.

---

## Snapshot Workflow (Tier 5B)

### Refresh Snapshot

- “Refresh Snapshot” is an explicit user action.
- It computes the dashboard from current inputs and **creates a new immutable snapshot**.
- It prunes the snapshot list to a fixed cap (**20**) and updates the active snapshot pointer.

### Viewing

- Viewing an existing snapshot **never recomputes**.
- The UI renders from the stored snapshot payloads (`request` + `response`).

### Snapshot Picker

- Shows previously saved snapshots for the current business.
- Selecting a snapshot updates the active snapshot and aligns the form inputs with that snapshot for deterministic viewing.

---

## Exports (Snapshot-bound)

Exports are only enabled when a saved snapshot exists.

### Export Center

- **Snapshot-bound only**: export operations read from the active snapshot.
- Export actions include:
  - Export JSON (full snapshot record)
  - Export Reviews CSV (only reviews in the snapshot date window)
  - Print Report (print view is snapshot-only)

### Print view

- “Print Report” uses the active snapshot as the sole data source.
- The print view is a representation of the frozen report, not a live recompute.

---

## Tier 5C Routing (Safe Ecosystem)

### 1) Review Responder handoff (Primary, draft-only)

**User intent:** “Respond in Review Responder” / “Send selected (Draft)”.

Rules:
- **Explicit click-only**: no auto-navigation, no auto-import.
- **Draft-only payload**:
  - stored in `sessionStorage` with a strict TTL
  - imported only after explicit confirmation in Review Responder
- **Tenant-safe**:
  - payload includes `businessId`
  - receiver verifies `businessId` match and blocks mismatches

Transport:
- `sessionStorage` key: `obd:handoff:rd:review-responder-draft:v1`
- TTL: **10 minutes**
- Routing flag requirement for receiver detection: `?handoff=rd`

Payload includes:
- `businessId`
- `snapshotId`
- `selectedReviews[]` with minimal deterministic fields:
  - platform label, rating, date, review text, responded flag
  - stable deterministic review id (hash) when no first-class review id exists

No additional PII is introduced beyond what the user already manually entered.

### 2) AI Help Desk (Awareness, link-only)

If themes/reviews suggest policy/hours/pricing/returns confusion:
- Show a calm CTA: “Turn repeated questions into Help Desk answers”
- **Link-only**: no review payload is sent automatically
- Explanation: “This can reduce repeated confusion in future reviews.”

### 3) SEO Audit & Roadmap (Awareness, link-only)

If snapshot indicates:
- low review volume, declining recent trend, or weak response coverage:

Show:
- Note: “Reputation influences local SEO trust signals.”
- CTA: “Open SEO Audit & Roadmap”
- **Link-only**: no data transfer

### 4) CRM awareness (Read-only)

- Shows a read-only line if derivable:
  - “X unique reviewers this snapshot (manual entry)”
- Explicit note:
  - “No contacts are created automatically.”

---

## Safety Guarantees (Trust Tone)

- **No automation**: nothing is auto-sent, auto-responded, auto-created, or auto-applied.
- **Deterministic snapshots**: exports and viewing are snapshot-derived; no surprise recomputes.
- **Tenant safety**: snapshots and handoffs are scoped to `businessId`; mismatches are blocked.
- **Disabled-not-hidden CTAs**: actions that are unavailable remain visible with explanations.

---

## QA Checklist (Manual)

### Core snapshot determinism

- [ ] Create a dataset (manual entry or CSV import), click **Refresh Snapshot**.
- [ ] Change a form input without refreshing; confirm the active snapshot view remains unchanged.
- [ ] Open **Snapshot Picker**, select an older snapshot; confirm viewing does not recompute.

### Export integrity

- [ ] Without a saved snapshot, confirm Export Center actions are disabled (tooltips explain why).
- [ ] With a saved snapshot, export JSON and CSV; confirm filenames include snapshot ID/date.
- [ ] Print Report; confirm the output corresponds to the active snapshot.

### Tier 5C routing (Review Responder)

- [ ] In “Recent Reviews”, select 1–3 reviews; click **Send selected to Review Responder (Draft)**.
- [ ] Confirm a toast appears with a link to open Review Responder.
- [ ] Open Review Responder with `?handoff=rd`; confirm:
  - import banner appears
  - import requires explicit click (“Review & Import”)
  - drafts can be loaded into the form manually (“Load into form”)
- [ ] Tenant mismatch test: open Review Responder with a different `businessId` than the handoff payload:
  - confirm import is blocked and payload is cleared.
- [ ] TTL test: wait >10 minutes before importing; confirm receiver reports expiration and does not import.

### Link-only awareness (Help Desk / SEO Audit)

- [ ] Confirm the CTAs are link-only and do not transfer review payloads.
- [ ] Confirm they are disabled-not-hidden when conditions are not met.


