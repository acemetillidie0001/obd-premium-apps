# AI Review Responder — Tier 5A + Tier 5B + Tier 5B+ + Tier 5C

**Status:** **LOCK-eligible (maintenance-mode safe)**  
**Last verified:** `main @ <COMMIT_HASH_PLACEHOLDER>`  
**Definition:** Draft-only review reply workspace. No automation. Nothing is posted automatically.

**Route:** `/apps/review-responder`  
**Category:** Reputation

---

## What this app IS

- A **draft-only** workspace that helps you write replies to customer reviews (Google/Facebook/etc.).
- A deterministic, review-scoped output system:
  - **Edited > Generated** precedence
  - **Regenerate never wipes edits**
  - Explicit reset semantics (inputs vs edits vs outputs)
- An **Export Center** that is the single authority for copy/download, reflecting exactly what you see.
- A calm, mobile-safe Tier 5A UX: accordion inputs with summaries + sticky action bar + disabled-not-hidden actions.

## What this app is NOT

Explicit non-goals / exclusions:

- NOT auto-posting
- NOT platform API replying (no direct Google/Facebook/Yelp reply API calls)
- NOT scheduling
- NOT bulk ingestion
- NOT a sentiment dashboard

---

## Deterministic rules (Tier 5B)

### Canonical response model

- Outputs are stored as canonical response items with:
  - `generatedText` (immutable per generation event)
  - optional `editedText` (user edits)
  - `status` (`draft` / `generated` / `edited`)

### Selector rules (single source of truth)

- Rendering and export resolve from **active text**:
  - `editedText` (if present and non-empty) **wins**
  - else `generatedText`

### Regenerate safety

- Regenerate updates **only unedited items**.
- Items with `editedText` are preserved (never overwritten).

### Reset semantics (explicit + safe)

- **Reset inputs**: resets form inputs to defaults; does **not** change outputs.
- **Reset edits**: clears `editedText` for edited items only; returns items to generated.
- **Clear outputs**: removes all outputs (generated + edited).

---

## Export Center (Tier 5B+ — single authority)

- Copy and Download actions are enabled only when there is at least one non-empty active response.
- Exports are deterministic (stable order) and **reflect your edits** exactly as seen.
- Platform-labeled export blocks are provided per response item, with per-item Copy.

Helper text:

- “Exports reflect your edits. Nothing is posted automatically.”

---

## Tier 5A UX parity

- Accordion-based inputs with collapsed summaries:
  - Business Context
  - Review Details
  - Response Strategy
  - Voice & Tone
  - Optional Enhancements
- Sticky Action Bar with:
  - status chip (Draft / Generated / Edited)
  - Generate/Regenerate
  - disabled-not-hidden reset actions + tooltips
  - Export jump link
- Persistent trust microcopy:
  - “Draft-only. Nothing is posted, sent, or published automatically.”
  - “This tool helps you write replies — you choose where to paste/post them.”

---

## Tier 5C ecosystem awareness (link-only, zero mutation)

The app includes safe, link-only callouts near the Export Center:

- Reputation Dashboard (`/apps/reputation-dashboard`) — read-only suggestion
- OBD CRM (`/apps/obd-crm`) — read-only suggestion

Explicit rule:

- “Links only — no data is transferred automatically.”

