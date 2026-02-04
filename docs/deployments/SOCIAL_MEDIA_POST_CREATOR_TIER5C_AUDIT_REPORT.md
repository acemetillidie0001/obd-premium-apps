## Social Media Post Creator (SMPC) — Tier 5C Audit Report

Status: LOCK-eligible (maintenance-mode safe)  
Validated on main @ <COMMIT_HASH_PLACEHOLDER>  
Draft-only social content. No posting, no scheduling, no automation.

### Executive summary (5–10 bullets)

- **SMPC is a draft-only social post workbench**: generates platform-aware posts, supports deterministic edits (inline + Fix Packs), and exports/copies resolved posts.
- **Tier 5A UX upgrades**: accordion inputs with 1-line summaries + sticky action cluster (disabled-not-hidden), plus always-visible trust microcopy.
- **Tier 5B determinism upgrades**: canonical `SMPCPostItem` model + canonical selector `getActivePosts()` (Edited > Generated) as the single source of truth.
- **Regenerate safety**: regenerate explicitly preserves edits (never overwrites edited content).
- **Tier 5B+ export integrity**: Export Center + Copy Bundles operate only on resolved structured posts; raw output is labeled reference-only.
- **Tier 5C ecosystem handoff**: SMPC → Social Auto-Poster uses sessionStorage with TTL, is gated behind `?handoff=smpc`, and is Apply/Dismiss only.
- **Tenant safety**: sender requires resolvable `businessId`; receiver is deny-by-default on mismatch and clears payload on mismatch/expiry/apply/dismiss.
- **Rate limiting + premium gating**: generation API is authenticated/premium-gated and rate limited, with strict request validation.

### A–G scorecard (PASS/FAIL, rationale + evidence)

| Category | Result | Rationale (short) | Evidence |
|---|---|---|---|
| A) Tenant safety / business scoping | PASS* | Generation API is premium/auth-gated + rate-limited and does not accept a client-supplied `businessId`. Handoff is tenant-guarded end-to-end (businessId required; mismatch denied-by-default). | API: `src/app/api/social-media-post-creator/route.ts:L387-L414`; premium: `src/lib/api/premiumGuard.ts:L33-L73`; rate limit: `src/lib/api/rateLimit.ts:L151-L216`; handoff schema: `src/lib/apps/social-media-post-creator/handoff.ts:L3-L69`; sender businessId guard: `src/app/apps/social-media-post-creator/page.tsx:L256-L263`, `src/app/apps/social-media-post-creator/page.tsx:L932-L960`; receiver deny-by-default: `src/app/apps/social-auto-poster/composer/page.tsx:L450-L475` |
| B) Deterministic behavior / canonical selector | PASS | Canonical types + canonical selector drive the entire UI; Edited > Generated is enforced; shuffle is view-only and applied after selection. | canonical type: `src/lib/apps/social-media-post-creator/types.ts:L1-L46`; canonical selector: `src/lib/apps/social-media-post-creator/getActivePosts.ts:L1-L33`; canonical imports in UI/tools: `src/app/apps/social-media-post-creator/page.tsx:L25-L28`, `src/components/smpc/SMPCExportCenterPanel.tsx:L3-L11`, `src/components/smpc/SMPCCopyBundles.tsx:L3-L11`, `src/components/smpc/SMPCFixPacks.tsx:L3-L15`, `src/components/smpc/SMPCQualityControlsTab.tsx:L3-L11`; wiring + view-only shuffle: `src/app/apps/social-media-post-creator/page.tsx:L377-L417`, `src/app/apps/social-media-post-creator/page.tsx:L635-L645` |
| C) No automation / draft-only truthfulness | PASS | SMPC has no posting/scheduling. Tier 5C receiver requires explicit Apply; trust microcopy matches behavior. | trust microcopy: `src/app/apps/social-media-post-creator/page.tsx:L1306-L1316`; sender stores payload + navigates with hint only: `src/app/apps/social-media-post-creator/page.tsx:L949-L960`; receiver modal + Apply requirement: `src/app/apps/social-auto-poster/composer/page.tsx:L1851-L1941` |
| D) Export integrity | PASS | Export Center + Copy Bundles export/copy only from `displayPosts` (selector-driven). Raw output is clearly labeled reference-only. | wiring: `src/app/apps/social-media-post-creator/page.tsx:L2233-L2284`, `src/app/apps/social-media-post-creator/page.tsx:L2310-L2385`; export panel uses `posts`: `src/components/smpc/SMPCExportCenterPanel.tsx:L7-L246`; copy bundles use `posts`: `src/components/smpc/SMPCCopyBundles.tsx:L7-L153`; raw reference-only label: `src/app/apps/social-media-post-creator/page.tsx:L2288-L2301` |
| E) Tier 5A UX parity | PASS | Accordion sections have stable state and summary lines; sticky action bar provides canonical cluster with disabled-not-hidden affordances. | accordion state + helpers: `src/app/apps/social-media-post-creator/page.tsx:L1041-L1069`; summary lines: `src/app/apps/social-media-post-creator/page.tsx:L1071-L1126`; sticky cluster: `src/app/apps/social-media-post-creator/page.tsx:L1762-L1873` |
| F) Tier 5C routing safety (handoff) | PASS* | Receiver only reads when `?handoff=smpc` is present; TTL is enforced; mismatch clears; Apply is additive append + basic dedupe + clears payload + cleans URL; Dismiss clears. Invalid payload is a safe no-op (not applied). | validator: `src/lib/apps/social-media-post-creator/handoff.ts:L3-L69`; TTL enforcement + clear on expiry: `src/app/apps/social-auto-poster/composer/page.tsx:L185-L219`; gated behind hint param + deny-by-default: `src/app/apps/social-auto-poster/composer/page.tsx:L450-L475`; additive + dedupe + clear + URL cleanup: `src/app/apps/social-auto-poster/composer/page.tsx:L655-L751`; modal Apply disabled by tenant guard: `src/app/apps/social-auto-poster/composer/page.tsx:L1851-L1941` |
| G) Resilience / guardrails | PASS | Calm empty/disabled states, defensive guards, and deterministic edit history. Regenerate preserves edits; undo/reset are explicit. Fix Packs preview/apply is explicit and uses deterministic inputs. | regenerate preserves edits: `src/app/apps/social-media-post-creator/page.tsx:L741-L745`; edit history + undo/reset: `src/app/apps/social-media-post-creator/page.tsx:L377-L425`, `src/app/apps/social-media-post-creator/page.tsx:L834-L841`, `src/app/apps/social-media-post-creator/page.tsx:L854-L936`, `src/app/apps/social-media-post-creator/page.tsx:L1028-L1036`; send disabled/guarded: `src/app/apps/social-media-post-creator/page.tsx:L932-L942`, `src/app/apps/social-media-post-creator/page.tsx:L2239-L2270`; Fix Packs explicit preview/apply: `src/components/smpc/SMPCFixPacks.tsx:L34-L72`, `src/components/smpc/SMPCFixPacks.tsx:L139-L205` |

\* **Notes on PASS\***:
- **A**: The generation route is authenticated/premium-gated and rate-limited, but does **not** explicitly accept or enforce a `businessId` field; tenant safety is achieved by session gating + the absence of client-supplied tenant overrides, and by strict tenant guards on the Tier 5C handoff.
- **F**: Invalid SMPC payloads are **not applied** (safe no-op). TTL expiry and mismatch actively clear the sender key; apply/dismiss also clears it.

### Detailed evidence per category

#### A) Tenant safety / business scoping

- **Generation endpoint is premium/auth gated** (401/403 guard):
  - `src/app/api/social-media-post-creator/route.ts:L393-L399`
  - `src/lib/api/premiumGuard.ts:L33-L73`
- **Generation endpoint is rate limited** (429):
  - `src/app/api/social-media-post-creator/route.ts:L397-L399`
  - `src/lib/api/rateLimit.ts:L151-L216`
- **Request validation does not include `businessId`** (no client-supplied tenant override accepted):
  - `src/app/api/social-media-post-creator/route.ts:L39-L64` (schema)
  - `src/app/api/social-media-post-creator/route.ts:L410-L414` (safeParse + validation error)
- **Sender requires resolvable `businessId` and refuses to open/send otherwise**:
  - `src/app/apps/social-media-post-creator/page.tsx:L256-L263`
  - `src/app/apps/social-media-post-creator/page.tsx:L932-L942`
  - `src/app/apps/social-media-post-creator/page.tsx:L949-L960`
- **Handoff payload includes `businessId` and is validated**:
  - `src/lib/apps/social-media-post-creator/handoff.ts:L8-L15`, `src/lib/apps/social-media-post-creator/handoff.ts:L53-L68`
- **Receiver deny-by-default on tenant mismatch and clears sender key**:
  - `src/app/apps/social-auto-poster/composer/page.tsx:L450-L475`

#### B) Deterministic behavior / canonical selector

- **Canonical type model** (`SMPCPostItem`, snapshots):
  - `src/lib/apps/social-media-post-creator/types.ts:L1-L46`
- **No duplicated post item types** (shared imports from canonical module across SMPC UI/tools):
  - `src/app/apps/social-media-post-creator/page.tsx:L25-L28`
  - `src/lib/apps/social-media-post-creator/getActivePosts.ts:L1-L17`
  - `src/lib/apps/social-media-post-creator/handoff.ts:L1-L15`
  - `src/components/smpc/SMPCExportCenterPanel.tsx:L3-L11`
  - `src/components/smpc/SMPCCopyBundles.tsx:L3-L11`
  - `src/components/smpc/SMPCFixPacks.tsx:L3-L15`
  - `src/components/smpc/SMPCQualityControlsTab.tsx:L3-L11`
- **Canonical selector** (Edited > Generated):
  - `src/lib/apps/social-media-post-creator/getActivePosts.ts:L3-L33`
- **Selector wiring and view-only shuffle (after selection)**:
  - `src/app/apps/social-media-post-creator/page.tsx:L393-L417`
  - `src/app/apps/social-media-post-creator/page.tsx:L635-L645`

#### C) No automation / draft-only truthfulness

- **Trust microcopy is always visible**:
  - `src/app/apps/social-media-post-creator/page.tsx:L1306-L1316`
- **Handoff is a “hint param” + stored payload only; receiver must explicitly Apply**:
  - `src/app/apps/social-media-post-creator/page.tsx:L949-L960`
  - `src/app/apps/social-auto-poster/composer/page.tsx:L1851-L1941`

#### D) Export integrity

- **Copy Bundles uses resolved posts**:
  - `src/app/apps/social-media-post-creator/page.tsx:L2233-L2238`
  - `src/components/smpc/SMPCCopyBundles.tsx:L13-L31`, `src/components/smpc/SMPCCopyBundles.tsx:L33-L153`
- **Export Center uses resolved posts**:
  - `src/app/apps/social-media-post-creator/page.tsx:L2310-L2385`
  - `src/components/smpc/SMPCExportCenterPanel.tsx:L13-L75`, `src/components/smpc/SMPCExportCenterPanel.tsx:L117-L246`
- **Raw output is labeled reference-only and not used for structured exports**:
  - `src/app/apps/social-media-post-creator/page.tsx:L2288-L2301`

#### E) Tier 5A UX parity

- **Accordion state + collapse/expand helpers**:
  - `src/app/apps/social-media-post-creator/page.tsx:L1041-L1069`
- **1-line summaries** (collapsed section summary strings):
  - `src/app/apps/social-media-post-creator/page.tsx:L1071-L1126`
- **Sticky action cluster with disabled-not-hidden actions**:
  - `src/app/apps/social-media-post-creator/page.tsx:L1762-L1873`

#### F) Tier 5C routing safety (handoff)

- **Handoff payload + validator**:
  - `src/lib/apps/social-media-post-creator/handoff.ts:L3-L69`
- **Receiver gated behind `?handoff=smpc`**:
  - `src/app/apps/social-auto-poster/composer/page.tsx:L450-L475`
- **TTL enforcement and clear on expiry**:
  - `src/app/apps/social-auto-poster/composer/page.tsx:L185-L210`
- **Apply is additive + deduped + clears payload + URL cleanup**:
  - `src/app/apps/social-auto-poster/composer/page.tsx:L674-L740`
- **Dismiss clears payload + URL cleanup**:
  - `src/app/apps/social-auto-poster/composer/page.tsx:L742-L751`

#### G) Resilience / guardrails

- **Calm empty states in export tools**:
  - Export Center: `src/components/smpc/SMPCExportCenterPanel.tsx:L117-L125`
  - Quality Controls: `src/components/smpc/SMPCQualityControlsTab.tsx:L67-L75`
- **Send is disabled/guarded when missing business context**:
  - `src/app/apps/social-media-post-creator/page.tsx:L932-L942`
  - `src/app/apps/social-media-post-creator/page.tsx:L2239-L2270`
- **Regenerate preserves edits**:
  - `src/app/apps/social-media-post-creator/page.tsx:L741-L745`
- **Explicit edit/reset/undo history**:
  - `src/app/apps/social-media-post-creator/page.tsx:L377-L417`
  - `src/app/apps/social-media-post-creator/page.tsx:L834-L841`
  - `src/app/apps/social-media-post-creator/page.tsx:L854-L936`
  - `src/app/apps/social-media-post-creator/page.tsx:L1028-L1036`
- **Fix Packs are preview-first and apply is explicit**:
  - `src/components/smpc/SMPCFixPacks.tsx:L54-L68` (preview/apply)
  - `src/components/smpc/SMPCFixPacks.tsx:L209-L268` (modal + Apply Fix button)

### What was NOT audited (explicit out-of-scope)

- Model quality and content correctness/truthfulness (LLM output can be wrong even when the system is deterministic).
- Prompt quality and “brand voice” effectiveness (subjective UX/content).
- Third-party outages or API instability (OpenAI availability, network issues).
- Any Social Auto-Poster posting/scheduling correctness beyond the SMPC import receiver path.
- Business logic correctness of premium entitlements (assumed by `hasPremiumAccessSafe()`).

### Recommendations (optional, low-risk)

- **Clear invalid SMPC handoff payloads on receiver read** (today: invalid payload is a safe no-op; clearing would reduce sessionStorage “stuck” cases). Evidence: `src/app/apps/social-auto-poster/composer/page.tsx:L191-L206`.
- **Add a routeKey when calling `checkRateLimit()`** from SMPC API route for better per-route telemetry (does not change behavior). Evidence: `src/app/api/social-media-post-creator/route.ts:L397-L399`, `src/lib/api/rateLimit.ts:L161-L216`.
- **Clarify “business scoping” expectation** for SMPC generation: currently session/premium gated with no `businessId` input; if multi-business-per-user is introduced, explicitly scope at the route boundary. Evidence: `src/app/api/social-media-post-creator/route.ts:L39-L64`.

### Verification (post-audit)

- **Validated on**: 2026-02-04
- **`pnpm run typecheck`**: PASS
- **`pnpm run vercel-build`**: PASS

Notes observed during build (non-blocking):
- Next.js workspace root warning due to multiple lockfiles (informational).
- Expected auth warnings for email delivery disabled (console fallback).

