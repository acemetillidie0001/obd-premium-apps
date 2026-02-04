## Social Media Post Creator (SMPC) — Tier 5C Audit Report

**App**: AI Social Media Post Creator (SMPC)  
**Scope**: Tier 5A UX parity + Tier 5B determinism/editing + Tier 5C ecosystem handoff (SMPC → Social Auto-Poster)  
**Audit date**: 2026-02-04  
**Target**: LOCK-ready / maintenance-mode safe

### Executive summary

SMPC meets Tier 5A/5B/5C requirements for a draft-only workbench: it uses a canonical post model and selector for deterministic outputs, protects user edits from regeneration, keeps exports authoritative via the selector, and implements a tenant-safe, TTL’d, apply/dismiss-only handoff to Social Auto-Poster with additive, deduped import behavior.

### A–G scorecard

- **A) Tenant safety**: **PASS**
  - Business context is required to send; receiver is deny-by-default on mismatch and clears payload.
- **B) Determinism (canonical selector, stable active posts)**: **PASS**
  - `getActivePosts()` is the single source of truth (Edited > Generated). Shuffle is view-only.
- **C) No automation (no posting/scheduling/auto-queueing)**: **PASS**
  - SMPC remains draft-only; Tier 5C integration is explicit Apply/Dismiss only.
- **D) Export integrity (selector-driven exports)**: **PASS**
  - Copy/Export surfaces use resolved `displayPosts` (active structured posts). Raw output is reference-only.
- **E) Tier 5A UX parity**: **PASS**
  - Accordion inputs + sticky action cluster + always-on trust microcopy.
- **F) Tier 5C routing safety (TTL, validator, apply/dismiss, clear on invalid, dedupe)**: **PASS**
  - TTL is enforced on receiver read; payload is validated; apply is explicit; payload is cleared; dedupe implemented.
- **G) Resilience (empty/disabled states, defensive guards)**: **PASS**
  - Disabled-not-hidden and guardrails are present on send/apply actions; empty states are handled calmly.

### Evidence (file paths + line ranges)

#### A) Tenant safety (businessId guard, deny-by-default)

- **Sender requires business context**: `src/app/apps/social-media-post-creator/page.tsx:L256-L263` (derives `businessId` from URL params)
- **Sender blocks without businessId**: `src/app/apps/social-media-post-creator/page.tsx:L932-L940` (toast + early return)
- **Payload includes businessId**: `src/lib/apps/social-media-post-creator/handoff.ts:L27-L51`
- **Receiver deny-by-default + clears on mismatch**: `src/app/apps/social-auto-poster/composer/page.tsx:L450-L462`
- **Receiver apply blocked on mismatch/missing**: `src/app/apps/social-auto-poster/composer/page.tsx:L655-L663` and `src/app/apps/social-auto-poster/composer/page.tsx:L674-L678`

#### B) Determinism (selector, stable active posts, shuffle view-only)

- **Canonical selector (Edited > Generated)**: `src/lib/apps/social-media-post-creator/getActivePosts.ts:L14-L33`
- **Selector drives active view**: `src/app/apps/social-media-post-creator/page.tsx:L400-L413`
- **Shuffle is view-only override**: `src/app/apps/social-media-post-creator/page.tsx:L409-L417` (clears shuffle on source changes)
- **Shuffle operates on active posts only**: `src/app/apps/social-media-post-creator/page.tsx:L635-L645`
- **Sticky status chip reflects selector status**: `src/app/apps/social-media-post-creator/page.tsx:L1762-L1793`

#### C) No automation (no posting/scheduling; handoff is apply-only)

- **Trust contract (draft-only)**: `src/app/apps/social-media-post-creator/page.tsx:L1306-L1316`
- **Handoff stores payload + navigates with hint param only**: `src/app/apps/social-media-post-creator/page.tsx:L949-L960`
- **Receiver requires explicit Apply**: `src/app/apps/social-auto-poster/composer/page.tsx:L1863-L1867` and `src/app/apps/social-auto-poster/composer/page.tsx:L1931-L1940`

#### D) Export integrity (selector-driven exports)

- **Exports copy bundles from active structured posts**: `src/app/apps/social-media-post-creator/page.tsx:L2233-L2238`
- **Raw output labeled reference-only; exports don’t use it**: `src/app/apps/social-media-post-creator/page.tsx:L2288-L2296`

#### E) Tier 5A UX parity (accordion + sticky action cluster)

- **Accordion state + expand/collapse helpers**: `src/app/apps/social-media-post-creator/page.tsx:L1041-L1069`
- **Sticky action cluster (disabled-not-hidden)**: `src/app/apps/social-media-post-creator/page.tsx:L1762-L1862`

#### F) Tier 5C routing safety (TTL, validator, apply/dismiss, clear on invalid, dedupe)

- **TTL constant + schema validation**: `src/lib/apps/social-media-post-creator/handoff.ts:L3-L15` and `src/lib/apps/social-media-post-creator/handoff.ts:L53-L69`
- **Receiver TTL enforcement + clear on expiry**: `src/app/apps/social-auto-poster/composer/page.tsx:L185-L206`
- **Receiver reads only when `?handoff=smpc` is present**: `src/app/apps/social-auto-poster/composer/page.tsx:L450-L475`
- **Apply behavior is additive + deduped**: `src/app/apps/social-auto-poster/composer/page.tsx:L679-L720`
- **Clear payload + URL cleanup on Apply/Dismiss**: `src/app/apps/social-auto-poster/composer/page.tsx:L722-L751`
- **Apply/Dismiss modal exists and Apply is disabled on tenant guard**: `src/app/apps/social-auto-poster/composer/page.tsx:L1860-L1941`

#### G) Resilience (empty states, disabled states, defensive guards)

- **Send action disabled when unavailable**: `src/app/apps/social-media-post-creator/page.tsx:L2248-L2269`
- **Open modal guards for empty posts / missing businessId**: `src/app/apps/social-media-post-creator/page.tsx:L932-L942`
- **Receiver handles expired payload quietly**: `src/app/apps/social-auto-poster/composer/page.tsx:L469-L473`

