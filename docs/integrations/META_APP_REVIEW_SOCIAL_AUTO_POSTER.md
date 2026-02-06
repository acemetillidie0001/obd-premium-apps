# Meta App Review Readiness Audit — Social Auto-Poster (Internal)

**Objective**: Inventory everything needed for Meta App Review for the Social Auto-Poster, confirming current code paths and what scopes/assets/behaviors are required.

**Scope / Constraints (must hold true for submission)**: docs-only output + light refactors allowed; **no schema changes**; **no background jobs**; **no auto-posting**; tenant-safe only (**membership-derived `businessId`**, no cross-tenant leakage).

---

## A) Status banner

- **Audit**: Meta review readiness audit (Social Auto-Poster)
- **Date**: 2026-02-04
- **Main commit**: TBD (fill with `git rev-parse HEAD` at submission time)

---

## 1) Locate Social Auto-Poster + Meta code (primary file paths)

### Social Auto-Poster UI entry page(s)

### Social Auto-Poster UI routes (Next.js app)

- `src/app/apps/social-auto-poster/page.tsx`
- `src/app/apps/social-auto-poster/setup/page.tsx`
- `src/app/apps/social-auto-poster/composer/page.tsx`
- `src/app/apps/social-auto-poster/queue/page.tsx`
- `src/app/apps/social-auto-poster/activity/page.tsx`

### Social posting API routes (Social Auto-Poster)

- **Generate / queue**
  - `src/app/api/social-auto-poster/generate/route.ts`
  - `src/app/api/social-auto-poster/queue/route.ts`
  - `src/app/api/social-auto-poster/queue/create/route.ts`
  - `src/app/api/social-auto-poster/queue/approve/route.ts`
  - `src/app/api/social-auto-poster/queue/delete/route.ts`
  - `src/app/api/social-auto-poster/queue/image/route.ts`
  - `src/app/api/social-auto-poster/queue/image/regenerate/route.ts`
  - `src/app/api/social-auto-poster/queue/simulate-run/route.ts`
- **Settings / activity**
  - `src/app/api/social-auto-poster/settings/route.ts`
  - `src/app/api/social-auto-poster/activity/route.ts`
  - `src/app/api/social-auto-poster/analytics/route.ts`
- **Runner (automation surface)**
  - `src/app/api/social-auto-poster/cron/route.ts` (Vercel Cron caller)
  - `src/app/api/social-auto-poster/runner/route.ts` (CRON_SECRET-protected)

### “Handoff receiver” code feeding Social Auto-Poster drafts

- `src/lib/apps/social-auto-poster/handoff/parseSocialHandoff.ts`
- `src/lib/apps/social-auto-poster/handoff-parser.ts`
- `src/lib/apps/social-auto-poster/handoff/socialHandoffTypes.ts`
- `src/lib/obd-framework/social-handoff-transport.ts`
- `src/lib/utils/handoffTransport.ts`

### Meta / Facebook / Instagram API routes

- `src/app/api/social-connections/meta/connect/route.ts`
- `src/app/api/social-connections/meta/request-pages-access/route.ts`
- `src/app/api/social-connections/meta/callback/route.ts`
- `src/app/api/social-connections/meta/status/route.ts`
- `src/app/api/social-connections/meta/test-post/route.ts`
- `src/app/api/social-connections/meta/disconnect/route.ts`

### Meta/Facebook/Instagram integration utilities (Graph client, auth helpers, env checks)

- **Feature flag + UI mapping**
  - `src/lib/apps/social-auto-poster/metaConnectionStatus.ts` (`META_PUBLISHING_ENABLED`)
  - `src/lib/apps/social-auto-poster/connection/connectionState.ts`
  - `src/lib/apps/social-auto-poster/metaErrorMapper.ts`
- **OAuth base URL / redirect URI helper**
  - `src/lib/apps/social-auto-poster/getBaseUrl.ts`
- **Publishing**
  - `src/lib/apps/social-auto-poster/publishers/metaPublisher.ts`
  - `src/lib/apps/social-auto-poster/processScheduledPost.ts`
  - `src/lib/apps/social-auto-poster/runDuePosts.ts`
- **Cron request verification**
  - `src/lib/apps/social-auto-poster/vercelCronVerification.ts`

---

## 2) Meta OAuth / login flow (as implemented)

### Stage 1 — Basic Connect (`public_profile`)

- **UI trigger**: Setup page (`src/app/apps/social-auto-poster/setup/page.tsx`) calls `POST /api/social-connections/meta/connect`.
- **Route**: `src/app/api/social-connections/meta/connect/route.ts`
  - Requires logged-in user (`auth()`) and premium access.
  - Generates CSRF `state`, stores in `meta_oauth_state` httpOnly cookie (10 min).
    - **Note**: state/nonce is **not** businessId-scoped today (cookie + session user only).
  - **Redirect URI wiring**: computed via `getMetaOAuthBaseUrl()` from `src/lib/apps/social-auto-poster/getBaseUrl.ts`.
  - Redirects to Meta OAuth dialog:
    - `https://www.facebook.com/v21.0/dialog/oauth`
    - `scope=public_profile`
    - `redirect_uri=<baseUrl>/api/social-connections/meta/callback`
- **Callback**: `src/app/api/social-connections/meta/callback/route.ts`
  - Validates `state` cookie.
  - Exchanges OAuth `code` for user access token:
    - `GET https://graph.facebook.com/v21.0/oauth/access_token`
  - Fetches basic user identity:
    - `GET https://graph.facebook.com/v21.0/me?fields=id,name&access_token=...`
  - Upserts `SocialAccountConnection` record for platform `"facebook"` (user-level).

### Stage 2 — Pages Access (`pages_show_list`, `pages_read_engagement`)

- **UI trigger**: Setup page calls `POST /api/social-connections/meta/request-pages-access`.
- **Route**: `src/app/api/social-connections/meta/request-pages-access/route.ts`
  - Verifies a basic Facebook connection exists in DB first.
  - Sets `meta_oauth_type=pages_access` cookie.
  - Redirects to OAuth dialog with:
    - `scope=pages_show_list,pages_read_engagement`
    - same callback route as Stage 1.
- **Callback behavior (pages access)**: `src/app/api/social-connections/meta/callback/route.ts`
  - Uses the new token to fetch pages:
    - `GET https://graph.facebook.com/v21.0/me/accounts?access_token=...`
  - Picks the **first** page with `access_token` and updates the existing Facebook connection to:
    - store `accessToken = selectedPage.access_token` (page token)
    - store `providerAccountId = selectedPage.id` (page id)
    - store metadata flags in `metaJson` (e.g., `pagesAccessGranted`)
  - Upserts `SocialPostingDestination` for platform `"facebook"`.

### Stage 3 — Publishing permissions (not wired into OAuth yet)

- The current OAuth implementation does **not** request `pages_manage_posts` / `instagram_content_publish` in any route.
- The codebase contains publisher code (Graph publish endpoints) behind a feature flag (see below).

---

## 3) Token storage location + shape

- **Meta app credentials**: environment variables
  - `META_APP_ID`
  - `META_APP_SECRET`
- **OAuth CSRF state**: short-lived cookies
  - `meta_oauth_state` (httpOnly)
  - `meta_oauth_type` (httpOnly)
- **Access tokens**: database (Prisma)
  - Model: `SocialAccountConnection` in `prisma/schema.prisma`
  - Field: `SocialAccountConnection.accessToken` (string)
  - Optional fields present: `refreshToken`, `tokenExpiresAt`, `metaJson`
  - Note: Meta flow currently stores user token (Stage 1) then overwrites with page token (Stage 2). No refresh flow is implemented for Meta.

### Tenant scoping invariant (current state)

- **Meta connection routes** (`/api/social-connections/meta/*`) currently enforce **session user** via `auth()` and use `userId` in queries, but **do not require membership-derived `businessId` context**.
  - This does **not** satisfy “business-scoped tenant safety” if a user can have multiple businesses/memberships.
  - Canonical membership-derived tenant resolver exists and should be used:
    - `src/lib/auth/tenant.ts` (`requireTenant()` → `{ businessId, userId, role }`)
    - `src/lib/auth/requireBusinessContext.ts` (membership-derived business context)
    - `src/lib/auth/permissions.server.ts` (permission gating within business context)

---

## 4) Existing Meta Graph API calls/endpoints (with review impact)

### OAuth + identity + pages

- `GET https://graph.facebook.com/v21.0/oauth/access_token` (code → access token)
- `GET https://graph.facebook.com/v21.0/me?fields=id,name` (basic identity)
- `GET https://graph.facebook.com/v21.0/me/accounts` (managed pages)

**Type**: discovery/read-only (not publish-capable).  
**Permissions**: `public_profile`, `pages_show_list`, `pages_read_engagement`.

### Facebook Page publishing (publisher + test-post)

- `POST https://graph.facebook.com/v21.0/{pageId}/feed` (text post)
- `POST https://graph.facebook.com/v21.0/{pageId}/photos` (image post)
- `GET https://graph.facebook.com/v21.0/{postId}?fields=permalink_url` (permalink)

**Type**: publish-capable.  
**Permissions**: `pages_manage_posts` (and typically `pages_read_engagement`/`pages_show_list` as part of the connection flow).

### Instagram publishing (publisher + test-post)

- `POST https://graph.facebook.com/v21.0/{igBusinessId}/media` (create container)
- `POST https://graph.facebook.com/v21.0/{igBusinessId}/media_publish` (publish container)
- `GET https://graph.facebook.com/v21.0/{postId}?fields=permalink` (permalink)

**Type**: publish-capable.  
**Permissions**: `instagram_content_publish` (+ linking/identity scope such as `instagram_basic` depending on UX needs).

---

## 5) Posting architecture (draft-only vs publish)

### What the product does today

- **Composer** (`src/app/apps/social-auto-poster/composer/page.tsx`) generates drafts and enqueues them via:
  - `POST /api/social-auto-poster/queue/create`
- **Queue** (`src/app/apps/social-auto-poster/queue/page.tsx`) supports workflow states:
  - `draft` → `approved` → `scheduled` → (runner) → `posted` / `failed`
- **Runner/cron** automatically processes scheduled items:
  - `GET|POST /api/social-auto-poster/cron` → `runDuePosts()` → `processScheduledPost()`
  - `GET|POST /api/social-auto-poster/runner` (secret protected) → same logic

### Meta publishing is gated (important)

- Real Meta publishing is blocked unless:
  - `META_PUBLISHING_ENABLED === "true"`
- Enforced in:
  - `src/app/api/social-connections/meta/test-post/route.ts`
  - `src/lib/apps/social-auto-poster/processScheduledPost.ts`

### Risk relative to “manual publish only”

- The presence of `/cron` + `/runner` is an **automation surface** that (when Meta publishing is enabled) supports **scheduled auto-posting**.
- For Meta App Review, if we commit to **manual, user-initiated publishing only**, we must ensure the shipped UX and code match that commitment (see “Code gaps”).

---

## B) Required permissions (Meta App Review request list)

**Facebook Pages**

- `pages_show_list`: let user select which Page to post to.
- `pages_read_engagement`: validate Page access and support Meta’s staged permission requirements.
- `pages_manage_posts`: publish to the Page (feed/photos).

**Instagram (IG Content Publishing API)**

- `instagram_content_publish`: publish media to IG Business account.
- `instagram_basic`: read basic IG account info needed for UX (e.g., username) and linking checks.

**Notes**

- Stage 1 currently requests only `public_profile`. Stage 2 requests only `pages_show_list,pages_read_engagement`.
- We should request publishing permissions only when the user explicitly enables publishing (staged permission UX).

---

## C) Required business assets (must-have in Meta UI)

- **Verified Business Manager**: already done (required for Advanced Access / App Review in most cases).
- **Meta app**: Live-mode capable app owned by the Business.
- **Facebook Page**: user must be admin/editor of the Page used for posting.
- **Instagram Business/Creator account** linked to that Page.
- **Test assets for review**: test user, test Page, test IG account that reviewers can access (or clear setup using Meta’s test roles).
- **System User** (if we move to system-user tokens later): Business Manager system user with assigned assets (Page + IG) and appropriate roles.

### App Domains + policy URLs (required for review)

- **App Domains**: production domain(s) used for OAuth redirect and app UI (TBD).
- **Privacy Policy URL**: `https://ocalabusinessdirectory.com/obd-business-suite-privacy-policy/`
- **Terms URL**: `https://ocalabusinessdirectory.com/obd-business-suite-terms-of-service/`
- **Data Deletion URL**: `https://<app-domain>/data-deletion` (implemented route: `/data-deletion`)

---

## D) Behavior commitments (review-safe)

- **User-initiated publishing only**:
  - A human clicks “Publish now” (or equivalent) in-app for each post.
  - No background jobs that publish without an in-app user action (**no cron runner**).
- **No automation/spam**:
  - No auto-generation-to-publish pipeline.
  - No auto-post loops, no engagement farming, no mass-posting.
- **Tenant-safe / business-scoped**:
  - Posting targets and tokens are scoped per authenticated membership-derived `businessId`.
  - Users can disconnect to revoke access and delete tokens.
- **Transparency**:
  - Clear permission explanations in the UI.
  - Clear “what we store” and “how to delete” (disconnect + `/data-deletion`).

---

## E) Screencast plan (2–3 minutes)

- **Login** to the product.
- Navigate to **Social Auto-Poster → Setup**.
- Show **permission explanation** and “what you’ll see in Facebook” note.
- Click **Connect Facebook** and pause on the **Meta consent screen** (show permissions).
- If staged: click **Enable Pages Access** and pause on the second consent screen.
- Show that connection status updates, and that the user can **disconnect**.
- Create a **draft** in **Composer**, then go to **Queue**.
- Click **Publish** for **Facebook** (single explicit click).
- Click **Publish** for **Instagram** (single explicit click).
- Show **Activity log** entry and **permalink**.
- Show **disconnect** and the **data deletion** page (`/data-deletion`).

---

## F) What Meta will reject (explicit)

- **Automation without clear in-app control**:
  - Background cron publishing, fully scheduled auto-posting, or “set-and-forget” posting.
- **Requesting permissions without a matching in-app feature**:
  - Asking for `instagram_content_publish` / `pages_manage_posts` but not demonstrating publishing UX.
- **Spam-like behavior**:
  - Bulk posting, high-frequency posting loops, or “auto-post everything” flows.
- **Missing transparency/compliance**:
  - No clear permission explanation, no disconnect, no data deletion process, broken Privacy/Terms links.
- **Security issues**:
  - Tokens exposed in UI/logs, weak CSRF in OAuth, unclear storage/retention.
- **Broken review experience**:
  - Reviewers can’t access test assets, consent screens not shown, demo requires internal secrets/tools.

---

## G) Code gaps to close before submission (no schema changes)

### Must-close to match “manual user-initiated publish only”

- **Remove/disable Meta scheduled auto-posting path for review**:
  - `src/app/api/social-auto-poster/cron/route.ts`
  - `src/app/api/social-auto-poster/runner/route.ts`
  - `src/lib/apps/social-auto-poster/runDuePosts.ts`
  - `src/lib/apps/social-auto-poster/processScheduledPost.ts`
  - `vercel.json` (cron schedule calling `/api/social-auto-poster/cron`)

### Must-close for tenant-safety (business-scoped)

- **Enforce membership-derived `businessId` context on Meta routes** (currently `auth()` + `userId` only):
  - `src/app/api/social-connections/meta/connect/route.ts`
  - `src/app/api/social-connections/meta/request-pages-access/route.ts`
  - `src/app/api/social-connections/meta/callback/route.ts`
  - `src/app/api/social-connections/meta/status/route.ts`
  - `src/app/api/social-connections/meta/test-post/route.ts`
  - `src/app/api/social-connections/meta/disconnect/route.ts`
  - Recommended approach: require `requireTenant()` and `requirePermission("SOCIAL_AUTO_POSTER", "APPLY")` where appropriate.

### Must-close for real IG publishing

- **Implement Stage 3 OAuth + IG discovery + destination selection** (currently not present in code):
  - Add a staged permission step to request:
    - `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`
  - Extend callback to discover/store IG Business account and destination (future file paths likely under `src/app/api/social-connections/meta/*` and `src/app/apps/social-auto-poster/setup/page.tsx`).

### Recommended hardening (review-friendly)

- **Token handling clarity**:
  - Confirm and document whether tokens are field-level encrypted or only “DB at rest” encrypted.
  - (If needed) add application-level encryption for `SocialAccountConnection.accessToken`.
  - Files: `prisma/schema.prisma`, `src/app/api/social-connections/meta/callback/route.ts`, `src/lib/prisma.ts`
- **Stop choosing the “first page” automatically**:
  - Current behavior selects the first page in `me/accounts`.
  - Implement explicit user page selection UX (setup page + destination write).
  - File: `src/app/api/social-connections/meta/callback/route.ts`
- **Remove temporary debug logging before submission**:
  - File: `src/app/api/social-connections/meta/connect/route.ts`
- **Align docs vs code on staged permissions**:
  - Ensure docs reflect the real staged flow and the review demo path.
  - Docs: `docs/meta/*`, `docs/apps/social-auto-poster-meta-staged-permissions.md`

---

## Meta Review Mode

### How to enable

- Set environment variable: `META_REVIEW_MODE=true`
- Default is off: `META_REVIEW_MODE` unset or `false`

### What it does (review safety)

- Disables automation execution surfaces (server-side 403 JSON):
  - `GET|POST /api/social-auto-poster/cron`
  - `GET|POST /api/social-auto-poster/runner`
  - `POST /api/social-auto-poster/queue/simulate-run`
- Adds defensive guards in internal scheduled-post code paths so they cannot run even if called indirectly.
- Keeps draft generation and queue management intact (manual workflow remains).
- Adds a reviewer-friendly banner + checklist in Social Auto-Poster Setup and a “Run Meta Test Post” CTA in Composer.

### Reviewer flow (URLs + clicks)

1. Open **Setup**: `/apps/social-auto-poster/setup`
   - Confirm “Meta Review Mode” banner and checklist are visible.
   - Click **Connect Facebook** (Stage 1) → complete Meta consent.
   - Click **Enable Pages Access** (Stage 2) → complete Meta consent.
2. Open **Composer**: `/apps/social-auto-poster/composer`
   - Create a draft and add it to queue.
   - Click **Run Meta Test Post** (manual publish demonstration).
3. Open **Activity**: `/apps/social-auto-poster/activity`
   - Confirm the attempt and any permalinks are visible.
4. Optional: Disconnect in Setup to show user control and data deletion behavior.

---

## OAuth scopes (exact)

### Stage 1 (Basic connect)

- Requested scopes: `public_profile`

### Stage 2 (Pages access)

- Requested scopes: `pages_show_list`, `pages_read_engagement`

### Stage 3 (Publishing) — planned for App Review submission

- Facebook: `pages_manage_posts`
- Instagram: `instagram_basic`, `instagram_content_publish`

---

## Signed OAuth state (tenant-safe)

- OAuth `state` is a **signed, time-limited token** (HMAC-SHA256) that embeds:
  - `businessId`
  - `userId`
  - `flow` (`basic` or `pages_access`)
  - `nonce`
  - `iat/exp` timestamps (TTL currently 10 minutes)
- The callback verifies signature + TTL and **derives `businessId` from state** (does not depend on cookies).
- Implementation: `src/lib/apps/social-auto-poster/metaOAuthState.ts`

---

## Troubleshooting (status → what to do)

| Status signal | Meaning | What to do |
|---|---|---|
| `nextSteps` includes “Configure META_APP_ID and META_APP_SECRET” | Meta app env missing | Set env vars and redeploy |
| `nextSteps` includes “Connect Meta” | No business-scoped connection stored | Use Setup → Connect Facebook |
| `token.isExpired=true` | Token expired | Disconnect and reconnect |
| `nextSteps` includes “Enable Pages Access” | Stage 2 not completed | Use Setup → Enable Pages Access |
| `nextSteps` includes “Publishing disabled until META_PUBLISHING_ENABLED=true” | Publishing flag off | Keep off during review; enable only after approval |

---

## Facebook Page Discovery

- API: `GET /api/social-connections/meta/pages`
- Graph call: `GET /me/accounts?fields=id,name,access_token,tasks`
- Output: publish-capable Pages only (tasks include `CREATE_CONTENT` or `MANAGE`)

## Instagram Business Detection

- API: `POST /api/social-connections/meta/select-page` with `{ "pageId": "..." }`
- Graph call: `GET /{pageId}?fields=instagram_business_account{id,username}`
- Output: `instagram.connected` + `igBusinessId` + `username`

## Meta Review Demo Flow (End-to-End)

1) Connect Meta (Stage 1)  
2) Enable Pages access (Stage 2)  
3) Discover Pages → Select a Page  
4) Detect linked IG Business account  
5) Run Test Post (manual click)  

## Common reviewer failure cases (and what UI says)

- **No Pages listed**: “No publish-capable Pages found.”
- **IG not linked**: “Convert Instagram to a Professional account and link it to this Facebook Page.”
- **Token expired**: nextSteps includes “Reconnect (token expired)”

---

## Publishing Access Flow (explicit OAuth step)

### Why this exists

- We keep the existing approved **Basic Connect** Facebook Login flow unchanged (minimal scopes).
- Publishing to a Facebook Page and Instagram Business account requires additional Meta permissions that typically require **Advanced Access / App Review**.
- To align with staged permission best practices, we request publishing scopes **only when the user explicitly clicks** “Request Publishing Access”.

### Exact permissions requested (and why)

**Facebook Pages**

- `pages_show_list`: list Pages the user manages (Page selection)
- `pages_read_engagement`: validate Page access + read basic Page info
- `pages_manage_posts`: publish content to the selected Page

**Instagram (IG Content Publishing API)**

- `instagram_basic`: read basic IG account info (e.g., username) for UX and linking checks
- `instagram_content_publish`: publish media to the linked IG Business account

### Reviewer path (click-by-click)

1. **Basic connect**: Setup → “Connect Facebook”
2. **Publishing access**: Setup → “Request Publishing Access” (second consent screen)
3. **Select Page**: Setup → pick a Page (stores page token + detects linked IG business account)
4. **Detect IG**: Setup shows linked IG username/ID (if available)
5. **Test post**: Setup → “Send Test Post” (guarded by `META_PUBLISHING_ENABLED=true`)

### Troubleshooting

- **Missing scopes**:
  - `/api/social-connections/meta/status` returns `requiredScopesMissing` (stable order) and `nextSteps` includes “Request Publishing Access”.
  - `/api/social-connections/meta/test-post` returns:
    - `{ ok:false, code:"MISSING_PUBLISHING_SCOPES", missing:[...] }`
- **Publishing disabled**:
  - If `META_PUBLISHING_ENABLED` is not `true`, publishing routes return:
    - `{ ok:false, code:"PUBLISHING_DISABLED", ... }`
  - The Setup UI keeps publishing actions disabled until the flag is enabled.


