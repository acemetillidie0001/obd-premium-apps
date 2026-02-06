# Review Request Automation

**Status:** LOCKED (maintenance-mode safe)  
**Route:** `/apps/review-request-automation`  
**Last verified:** main @ fe8d534fa78a0b89f1c09fb979bc60fa356246cd  
**One-line:** Draft-first, snapshot-based campaign planner. No autonomous behavior.

## What this app IS

- A draft-first workflow for configuring a review request campaign (business info, platform/link, rules, customers).
- A **snapshot-based** Templates / Queue / Results experience:
  - outputs are computed once when you explicitly create a snapshot
  - viewing tabs never recomputes
  - exports reflect the active snapshot
- A manual, review-first queue you can copy/export/send from (no background sending).

## What this app is NOT

- Not an autonomous “automation engine”.
- Not background crawling, scraping, or platform manipulation.
- Not unattended sending or scheduling.
- Not a silent CRM sync tool (imports/exports are explicit; best-effort CRM writes are tied to explicit user actions).

## Why this is not autonomous automation

- Templates and queue items are only generated when you explicitly click **Create New Snapshot**.
- Templates / Queue / Results are snapshot-derived and remain stable until you create a new snapshot.
- There are no background jobs, polling loops, or unattended scheduling in the UI.
- We do not log into platforms, post reviews, auto-submit forms, or auto-post content.
- Cross-app awareness is link-only by default (no implied syncing).
- Exports are snapshot-labeled so what you export matches what you reviewed.

## Snapshot-based workflow (canonical)

- **Create New Snapshot**: the only action that computes templates, queue state, and results.
- **Snapshot History**: read-only review of prior snapshots; viewing does not change the active snapshot.
- **Set Active Snapshot**: explicit action to switch which snapshot the UI uses for Templates/Queue/Results.

## Exports (snapshot-safe)

- **Queue CSV**: snapshot-derived filename: `review-requests-snapshot-{snapshotIdShort}.csv` (columns unchanged).
- **Snapshot JSON**: snapshot-derived filename: `review-requests-snapshot-{snapshotIdShort}.json` (includes `exportedAt`).

## Storage model

- Draft edits persist locally for convenience (draft-only localStorage).
- Snapshots are stored locally (localStorage) and treated as immutable historical records.
- Optional database persistence is explicit and user-initiated (Save to database + Create New Snapshot).

## Detailed technical doc

- See `docs/apps/review-request-automation-v3.md` for the full implementation and API notes.

