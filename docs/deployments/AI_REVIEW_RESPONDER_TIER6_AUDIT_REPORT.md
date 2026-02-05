## AI Review Responder — Tier 6 Audit Report (Tier 6-1 → 6-4)

Status: **Deployment-audit complete** (evidence-based)  
Validated on: **2026-02-05**  
Code reference: `dff9b8b4a59defde5ce3204861079136c5b3cadb` (working tree may include uncommitted changes)

Tier 6 scope audited:
- **Tier 6-1**: Response History (snapshot-only, read-only)
- **Tier 6-2**: “Why this reply works” (Explain Mode, one-shot per item)
- **Tier 6-3**: Platform hints (static copy)
- **Tier 6-4**: Power-user keyboard shortcuts (scoped to response card/editor)

---

### 1) Executive summary (what changed, why safe)

- **History is persisted but read-only**: snapshots are tenant-scoped, immutable records; UI provides viewing + manual copy only (no restore/apply automation).  
  Evidence: API is tenant-derived and has GET/POST only `src/app/api/review-responder/snapshots/route.ts:L107-L230`; detail is GET-only and tenant-checked `src/app/api/review-responder/snapshots/[id]/route.ts:L41-L100`; UI “History is read-only” `src/app/apps/review-responder/page.tsx:L2149-L2156`, read-only snapshot view `src/app/apps/review-responder/page.tsx:L2270-L2275`.
- **Explain Mode is optional and one-shot**: explanation bullets are generated only when the user clicks; edits do not auto-update the explanation unless explicitly regenerated.  
  Evidence: uses active text at click time and stores bullets on the item `src/app/apps/review-responder/page.tsx:L945-L999`; UI microcopy states “Generated once…” `src/app/apps/review-responder/page.tsx:L1973-L1977`.
- **Platform hints are static (zero-risk)**: platform guidance is UI-only copy under the platform selector.  
  Evidence: `src/app/apps/review-responder/page.tsx:L1303-L1357`.
- **Keyboard shortcuts are scoped**: no global handlers; shortcuts are limited to response cards and the textarea editor, and only act when relevant.  
  Evidence: per-card copy shortcut `src/app/apps/review-responder/page.tsx:L1782-L1795`; editor save/cancel shortcuts `src/app/apps/review-responder/page.tsx:L1918-L1939`; visible micro-hint `src/app/apps/review-responder/page.tsx:L1945-L1949`.
- **Draft-only trust remains consistent**: the app is still draft-only (no posting/scheduling/automation) and states this persistently.  
  Evidence: persistent draft-only notice `src/app/apps/review-responder/page.tsx:L1017-L1031`.

---

### 2) A–G scorecard (PASS / CONDITIONAL / FAIL)

| Category | Result | Rationale (short) |
|---|---|---|
| **A) Tenant safety** | **PASS** | New persisted history uses membership-derived tenant boundary in server routes; snapshot detail enforces tenant match. |
| **B) Determinism** | **PASS** | Canonical response model retains stable IDs + deterministic ordering; snapshots are immutable once created. (Explain text is LLM-generated but is one-shot and non-reactive unless explicitly regenerated.) |
| **C) No automation** | **PASS** | No background jobs, no platform posting/scheduling; all actions remain explicit user-initiated. |
| **D) Export integrity** | **PASS** | Export is still derived from canonical active state (edited > generated). History supports manual copy only; no silent export/restore. |
| **E) Tier 5A UX parity** | **PASS** | Accordion + sticky action bar + disabled-not-hidden actions remain; Tier 6 adds are additive and unobtrusive. |
| **F) Tier 5C routing safety** | **PASS** | Receiver handoff remains gated and deny-by-default on missing/mismatched business context; next steps remain link-only. |
| **G) Resilience** | **CONDITIONAL** | Clear error states + bounded payload sizes exist; snapshot listing is bounded to latest 50. No explicit retention cap is enforced at write-time (acceptable for Tier 6 scope but worth monitoring). |

---

### 3) Tier 6 Addendum (behavior guarantees)

#### Tier 6-1 — Response History (snapshot-only, read-only)

- **Tenant scope is enforced server-side**: list/create derive `businessId` from membership context (not query/body).  
  Evidence: `requireTenant()` contract `src/lib/auth/tenant.ts:L7-L15`; snapshots GET/POST use `requireTenant()` `src/app/api/review-responder/snapshots/route.ts:L119-L123`, `src/app/api/review-responder/snapshots/route.ts:L180-L183`.
- **Read-only guarantee**: no restore/apply endpoints; detail route is GET-only and enforces tenant match; UI only allows viewing + manual copy.  
  Evidence: snapshots route defines GET and POST only `src/app/api/review-responder/snapshots/route.ts:L107-L230`; detail route tenant check `src/app/api/review-responder/snapshots/[id]/route.ts:L79-L92`; UI “History is read-only” `src/app/apps/review-responder/page.tsx:L2149-L2156`; “Copy from snapshot (manual paste/post)” `src/app/apps/review-responder/page.tsx:L2328-L2338`.
- **Immutable storage shape**: table stores `createdAt` + JSON payload; no `updatedAt` field and no update route.  
  Evidence: Prisma model `prisma/schema.prisma:L881-L891`; migration table definition `prisma/migrations/20260205090000_add_review_responder_response_history/migration.sql:L1-L14`.
- **Input summary is minimal** (hash/length flags, not full review text):  
  Evidence: input summary builder `src/app/apps/review-responder/page.tsx:L663-L682`; validation schema enforces summary shape `src/app/api/review-responder/snapshots/route.ts:L39-L75`.

#### Tier 6-2 — Explain Mode (“Why this reply works”, one-shot)

- **Generated from active text at click-time**: explanation request uses `getActiveResponseText(item)`; no auto-refresh on subsequent edits.  
  Evidence: active text selector `src/app/apps/review-responder/page.tsx:L184-L187`; explain generation uses activeText at time of click `src/app/apps/review-responder/page.tsx:L945-L965`.
- **One-shot storage on the item**: bullets are stored on the `ReviewResponseItem` and remain until explicit regenerate or the active text is reset/regenerated.  
  Evidence: stores `explanation` + `explanationStatus` `src/app/apps/review-responder/page.tsx:L974-L987`; UI statement “Generated once…” `src/app/apps/review-responder/page.tsx:L1973-L1977`.
- **Explicit regenerate**: UI provides “Regenerate explanation” explicitly; disabled while generating or while editing.  
  Evidence: button labeling and gating `src/app/apps/review-responder/page.tsx:L1979-L2002`.
- **API constraints and calm copy**: explain API enforces 3–5 bullets and bans scoring/warnings via system instructions; request size is capped.  
  Evidence: request/response schema caps `src/app/api/review-responder/explain/route.ts:L14-L37`; system rules (no “you should”, no grades/warnings) `src/app/api/review-responder/explain/route.ts:L87-L108`.

#### Tier 6-3 — Platform hints (static, zero-risk)

- **Static-only copy**: rendered via `<details>` under platform selector; no API calls.  
  Evidence: `src/app/apps/review-responder/page.tsx:L1303-L1357`.
- **Trust line present**: “Guidance only — you decide what to post.”  
  Evidence: `src/app/apps/review-responder/page.tsx:L1311-L1314`.

#### Tier 6-4 — Keyboard shortcuts (power-user, scoped)

- **Scoped to response card/editor only**:
  - Copy shortcut is handled on the response card container (bubbled key events).  
    Evidence: `src/app/apps/review-responder/page.tsx:L1782-L1795`.
  - Save/Cancel shortcuts are handled on the textarea only, and only while editing.  
    Evidence: `src/app/apps/review-responder/page.tsx:L1918-L1939`.
- **Non-interference with normal typing**: shortcuts require modifier keys (Ctrl/⌘ or Ctrl/⌘+Shift) or Esc; not triggered during ordinary text entry.  
  Evidence: modifier checks `src/app/apps/review-responder/page.tsx:L1788-L1794`, `src/app/apps/review-responder/page.tsx:L1931-L1934`.
- **Micro-hint visible while editing**: “Save: Ctrl/⌘+Enter • Cancel: Esc”.  
  Evidence: `src/app/apps/review-responder/page.tsx:L1945-L1949`.

---

### 4) Evidence section (A–G details)

#### A) Tenant safety (business scoping everywhere, no cross-tenant)

- **Canonical server-side tenant resolver** (`requireTenant`) is membership-derived and warns against `?businessId=` use.  
  Evidence: `src/lib/auth/tenant.ts:L7-L15`, `src/lib/auth/tenant.ts:L17-L56`.
- **Snapshots list/create are tenant-scoped** (ignores any businessId in body/query for scoping) and require permission.  
  Evidence: `src/app/api/review-responder/snapshots/route.ts:L119-L123`, `src/app/api/review-responder/snapshots/route.ts:L168-L183`.
- **Snapshot detail enforces tenant match** (403 on mismatch).  
  Evidence: `src/app/api/review-responder/snapshots/[id]/route.ts:L79-L85`.
- **Tier 5C RD handoff is gated and deny-by-default on missing/mismatch business context**.  
  Evidence: receiver gating + checks `src/app/apps/review-responder/page.tsx:L394-L427` (route flag + businessId required + mismatch blocked).

#### B) Determinism (canonical selectors, stable IDs/order, snapshots immutable)

- **Stable, deterministic IDs** derived from platform + rating + normalized review text excerpt using a deterministic hash.  
  Evidence: `src/app/apps/review-responder/page.tsx:L154-L166`, `src/app/apps/review-responder/page.tsx:L175-L182`.
- **Deterministic ordering** by response kind order + id (stable sort key).  
  Evidence: `src/app/apps/review-responder/page.tsx:L134-L142`, `src/app/apps/review-responder/page.tsx:L189-L197`.
- **API → canonical items** uses baseId + kind to derive item IDs, with a fixed kind order.  
  Evidence: `src/app/apps/review-responder/page.tsx:L212-L249`.
- **Snapshots are immutable**: storage model has `createdAt` and no update metadata; API exposes create + read only.  
  Evidence: `prisma/schema.prisma:L881-L891`; `src/app/api/review-responder/snapshots/route.ts:L107-L230`; `src/app/api/review-responder/snapshots/[id]/route.ts:L41-L100`.

#### C) No automation (no posting/scheduling/background jobs)

- **Trust microcopy explicitly states draft-only** and matches behavior (manual copy/download).  
  Evidence: `src/app/apps/review-responder/page.tsx:L1017-L1031`.
- **All state changes are user-initiated** (buttons / explicit fetch calls).  
  Evidence: generate via explicit form submit fetch `src/app/apps/review-responder/page.tsx:L822-L873`; snapshot save is explicit `src/app/apps/review-responder/page.tsx:L740-L795`.

#### D) Export integrity (exports from canonical active state)

- **Edited > generated selector** defines the active text.  
  Evidence: `src/app/apps/review-responder/page.tsx:L184-L187`.
- **Export builder uses canonical active state** and is disabled unless there is non-empty active text.  
  Evidence: export gating `src/app/apps/review-responder/page.tsx:L609-L611`; export builder `src/app/apps/review-responder/page.tsx:L620-L631`.
- **Export Center is the single authority** and states “Exports reflect your edits.”  
  Evidence: `src/app/apps/review-responder/page.tsx:L2026-L2040`, `src/app/apps/review-responder/page.tsx:L2079-L2134`.
- **History does not auto-export/restore**; it provides manual copy only.  
  Evidence: `src/app/apps/review-responder/page.tsx:L2328-L2338`.

#### E) Tier 5A UX parity (accordion + sticky bar + disabled-not-hidden)

- **Accordion sections with summaries** for input parity.  
  Evidence: `src/app/apps/review-responder/page.tsx:L479-L532`.
- **Sticky action bar** provides predictable actions and disabled-not-hidden semantics with tooltips.  
  Evidence: `src/app/apps/review-responder/page.tsx:L1640-L1739`.
- **Tier 6 controls follow disabled-not-hidden** patterns (e.g., Save snapshot).  
  Evidence: `src/app/apps/review-responder/page.tsx:L2041-L2056`.

#### F) Tier 5C routing safety (link-only, no mutation)

- **Receiver path is gated** by explicit route flags and requires matching business context.  
  Evidence: `src/app/apps/review-responder/page.tsx:L394-L427`.
- **Next steps are explicitly “Links only”** and do not transfer data.  
  Evidence: `src/app/apps/review-responder/page.tsx:L2370-L2374`.

#### G) Resilience (error states, network failures, large text handling, storage size guards)

- **Network / API failures handled with visible error UI** for history load/save.  
  Evidence: history load error handling `src/app/apps/review-responder/page.tsx:L684-L706`; save error handling `src/app/apps/review-responder/page.tsx:L787-L794`; history error UI `src/app/apps/review-responder/page.tsx:L2183-L2187`.
- **Payload size caps**:
  - Generation caps reviewText length (5000) via API validation.  
    Evidence: `src/app/api/review-responder/route.ts:L49-L67` (reviewText max 5000).
  - Snapshot caps response text per item (20000) and uses strict schemas.  
    Evidence: `src/app/api/review-responder/snapshots/route.ts:L57-L75` (activeText max 20000, strict).
  - Explain caps activeText (20000) and bullet lengths (max 220) with 3–5 bullets.  
    Evidence: `src/app/api/review-responder/explain/route.ts:L14-L37`.
- **Snapshot list is bounded** to latest 50 per business (read-path guard).  
  Evidence: `src/app/api/review-responder/snapshots/route.ts:L124-L137`.
- **Conditional note**: there is no explicit write-time retention cap (snapshots can grow over time). This matches Tier 6 scope, but merits operational monitoring.

---

### Verification (post-audit)

- **Validated on**: 2026-02-05
- **`pnpm run typecheck`**: PASS
- **`pnpm run vercel-build`**: PASS

Build notes observed (non-blocking):
- Next.js workspace root warning due to multiple lockfiles (informational).
- Expected auth warnings for email delivery disabled (console fallback).

